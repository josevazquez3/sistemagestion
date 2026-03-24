import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ensureMayorTables } from "@/lib/tesoreria/mayorRawQueries";

const ROLES = ["ADMIN", "TESORERO", "SUPER_ADMIN"] as const;

function canAccess(roles: string[]) {
  return ROLES.some((r) => roles.includes(r));
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
