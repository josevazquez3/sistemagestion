import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const ROLES = ["SUPER_ADMIN", "ADMIN", "TESORERO"] as const;

function canAccess(roles: string[]) {
  return ROLES.some((r) => roles.includes(r));
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  const roles = (session?.user as { roles?: string[] })?.roles ?? [];
  if (!canAccess(roles)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const ids = Array.isArray(body?.ids)
      ? body.ids.filter((id: unknown) => Number.isInteger(id) && Number(id) > 0).map(Number)
      : [];

    if (ids.length === 0) {
      return NextResponse.json({ error: "Debe enviar un array de ids no vacío." }, { status: 400 });
    }

    const res = await prisma.proveedor.deleteMany({
      where: { id: { in: ids } },
    });

    return NextResponse.json({ eliminados: res.count });
  } catch {
    return NextResponse.json({ error: "Error al eliminar proveedores seleccionados." }, { status: 500 });
  }
}
