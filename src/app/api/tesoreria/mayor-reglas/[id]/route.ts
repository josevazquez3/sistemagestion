import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ensureMayorTables } from "@/lib/tesoreria/mayorRawQueries";
import { normalizarTextoMayor } from "@/lib/tesoreria/mayorReglasTexto";

const ROLES = ["ADMIN", "TESORERO", "SUPER_ADMIN"] as const;

function canAccess(roles: string[]) {
  return ROLES.some((r) => roles.includes(r));
}

export async function PUT(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const roles = (session?.user as { roles?: string[] })?.roles ?? [];
  if (!canAccess(roles)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }
  const { id: idStr } = await ctx.params;
  const id = parseInt(idStr, 10);
  if (!id || Number.isNaN(id)) {
    return NextResponse.json({ error: "id inválido" }, { status: 400 });
  }

  let body: { palabra?: string; cuentaId?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
  }

  const raw = (body.palabra ?? "").trim();
  if (!raw) return NextResponse.json({ error: "palabra es obligatoria" }, { status: 400 });
  const palabra = normalizarTextoMayor(raw).replace(/\s+/g, " ").trim();
  if (palabra.length < 2) {
    return NextResponse.json({ error: "palabra demasiado corta" }, { status: 400 });
  }

  const cuentaId = Number(body.cuentaId);
  if (!cuentaId || Number.isNaN(cuentaId)) {
    return NextResponse.json({ error: "cuentaId inválido" }, { status: 400 });
  }

  try {
    await ensureMayorTables();
    const existente = await prisma.mayorRegla.findUnique({ where: { id } });
    if (!existente) return NextResponse.json({ error: "Regla no encontrada" }, { status: 404 });

    const cuenta = await prisma.mayorCuenta.findUnique({ where: { id: cuentaId } });
    if (!cuenta) return NextResponse.json({ error: "Cuenta no encontrada" }, { status: 400 });

    const updated = await prisma.mayorRegla.update({
      where: { id },
      data: { palabra, cuentaId },
      include: { cuenta: { select: { nombre: true } } },
    });

    return NextResponse.json({
      id: updated.id,
      palabra: updated.palabra,
      cuentaId: updated.cuentaId,
      cuentaNombre: updated.cuenta.nombre,
      createdAt: updated.createdAt.toISOString(),
    });
  } catch (err: unknown) {
    const code =
      err && typeof err === "object" && "code" in err ? String((err as { code: string }).code) : "";
    if (code === "P2002") {
      return NextResponse.json(
        { error: "Ya existe una regla con esa palabra clave" },
        { status: 409 }
      );
    }
    console.error("mayor-reglas PUT:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error al actualizar" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const roles = (session?.user as { roles?: string[] })?.roles ?? [];
  if (!canAccess(roles)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }
  const { id: idStr } = await ctx.params;
  const id = parseInt(idStr, 10);
  if (!id || Number.isNaN(id)) {
    return NextResponse.json({ error: "id inválido" }, { status: 400 });
  }
  try {
    await ensureMayorTables();
    await prisma.mayorRegla.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const code = err && typeof err === "object" && "code" in err ? String((err as { code: string }).code) : "";
    if (code === "P2025") {
      return NextResponse.json({ error: "Regla no encontrada" }, { status: 404 });
    }
    console.error("mayor-reglas DELETE:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error al eliminar" },
      { status: 500 }
    );
  }
}
