import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const ROLES = ["SUPER_ADMIN", "ADMIN", "TESORERO"] as const;

function canAccess(roles: string[]) {
  return ROLES.some((r) => roles.includes(r));
}

/** Si la migración aún no corrió en esta BD, crea la columna (PostgreSQL). */
async function ensureNoEmiteFacturaColumn() {
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "Proveedor" ADD COLUMN IF NOT EXISTS "noEmiteFactura" BOOLEAN NOT NULL DEFAULT false
  `);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const roles = (session?.user as { roles?: string[] })?.roles ?? [];
  if (!canAccess(roles)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { id } = await params;
  const proveedorId = Number(id);
  if (!Number.isInteger(proveedorId) || proveedorId <= 0) {
    return NextResponse.json({ error: "ID inválido." }, { status: 400 });
  }

  try {
    const body = await req.json();
    const noEmiteFactura = Boolean(body?.noEmiteFactura);

    await ensureNoEmiteFacturaColumn();

    // $executeRaw: evita depender de Prisma Client regenerado (p. ej. bloqueo EPERM en Windows).
    const res = await prisma.$executeRaw`
      UPDATE "Proveedor"
      SET "noEmiteFactura" = ${noEmiteFactura}, "updatedAt" = CURRENT_TIMESTAMP
      WHERE "id" = ${proveedorId}
    `;
    const affected = typeof res === "bigint" ? Number(res) : Number(res);
    if (affected === 0) {
      return NextResponse.json({ error: "Proveedor no encontrado." }, { status: 404 });
    }

    return NextResponse.json({ id: proveedorId, noEmiteFactura });
  } catch (error) {
    console.error("PATCH /api/proveedores/[id]/no-emite-factura:", error);
    const detail = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      {
        error: "No se pudo actualizar el proveedor.",
        ...(process.env.NODE_ENV === "development" ? { detail } : {}),
      },
      { status: 500 }
    );
  }
}
