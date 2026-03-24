import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ensureMayorTables } from "@/lib/tesoreria/mayorRawQueries";
import { normalizarTextoMayor } from "@/lib/tesoreria/mayorReglasTexto";

const ROLES = ["ADMIN", "TESORERO", "SUPER_ADMIN"] as const;

function canAccess(roles: string[]) {
  return ROLES.some((r) => roles.includes(r));
}

function serialize(r: {
  id: number;
  palabra: string;
  cuentaId: number;
  createdAt: Date;
  cuenta: { nombre: string };
}) {
  return {
    id: r.id,
    palabra: r.palabra,
    cuentaId: r.cuentaId,
    cuentaNombre: r.cuenta.nombre,
    createdAt: r.createdAt.toISOString(),
  };
}

export async function GET() {
  const session = await auth();
  const roles = (session?.user as { roles?: string[] })?.roles ?? [];
  if (!canAccess(roles)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }
  try {
    await ensureMayorTables();
    const rows = await prisma.mayorRegla.findMany({
      include: { cuenta: { select: { nombre: true } } },
      orderBy: [{ palabra: "asc" }],
    });
    return NextResponse.json(rows.map(serialize));
  } catch (err) {
    console.error("mayor-reglas GET:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error al listar" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const session = await auth();
  const roles = (session?.user as { roles?: string[] })?.roles ?? [];
  if (!canAccess(roles)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }
  let body: { palabra?: string; cuentaId?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
  }
  const raw = (body.palabra ?? "").trim();
  if (!raw) {
    return NextResponse.json({ error: "palabra es obligatoria" }, { status: 400 });
  }
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
    const cuenta = await prisma.mayorCuenta.findUnique({ where: { id: cuentaId } });
    if (!cuenta) {
      return NextResponse.json({ error: "Cuenta no encontrada" }, { status: 400 });
    }
    const creado = await prisma.mayorRegla.create({
      data: { palabra, cuentaId },
      include: { cuenta: { select: { nombre: true } } },
    });
    return NextResponse.json(serialize(creado));
  } catch (err: unknown) {
    const code = err && typeof err === "object" && "code" in err ? String((err as { code: string }).code) : "";
    if (code === "P2002") {
      return NextResponse.json(
        { error: "Ya existe una regla con esa palabra clave" },
        { status: 409 }
      );
    }
    console.error("mayor-reglas POST:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error al crear" },
      { status: 500 }
    );
  }
}
