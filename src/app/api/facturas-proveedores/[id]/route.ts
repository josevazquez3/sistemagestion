import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parsearFechaAR } from "@/lib/parsearExtracto";

const ROLES = ["SUPER_ADMIN", "ADMIN", "TESORERO"] as const;

function canAccess(roles: string[]) {
  return ROLES.some((r) => roles.includes(r));
}

async function ensureFacturaProveedorTable() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "FacturaProveedor" (
      "id" SERIAL NOT NULL,
      "mes" INTEGER NOT NULL,
      "anio" INTEGER NOT NULL,
      "proveedorId" INTEGER NOT NULL,
      "puntoVenta" INTEGER NOT NULL,
      "nroFactura" INTEGER NOT NULL,
      "cuit" TEXT NOT NULL,
      "fecha" TIMESTAMP(3) NOT NULL,
      "descripcion" TEXT NOT NULL,
      "tipoComprobante" TEXT NOT NULL,
      "importe" DOUBLE PRECISION NOT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "FacturaProveedor_pkey" PRIMARY KEY ("id")
    );
  `);
}

type FacturaRow = {
  id: number;
  mes: number;
  anio: number;
  proveedorId: number;
  puntoVenta: number;
  nroFactura: number;
  cuit: string;
  fecha: Date;
  descripcion: string;
  tipoComprobante: string;
  importe: number;
  createdAt: Date;
  updatedAt: Date;
};

async function hydrateFactura(row: FacturaRow | undefined) {
  if (!row) return null;
  const proveedor = await prisma.proveedor.findUnique({ where: { id: row.proveedorId } });
  return {
    ...row,
    fecha: row.fecha.toISOString(),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    proveedor,
  };
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const roles = (session?.user as { roles?: string[] })?.roles ?? [];
  if (!canAccess(roles)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { id } = await params;
  const facturaId = Number(id);
  if (!Number.isInteger(facturaId)) {
    return NextResponse.json({ error: "ID inválido." }, { status: 400 });
  }

  try {
    const body = await req.json();
    const proveedorId = Number(body?.proveedorId);
    const puntoVenta = Number(body?.puntoVenta);
    const nroFactura = Number(body?.nroFactura);
    const cuit = String(body?.cuit ?? "").trim();
    const importe = Number(body?.importe);
    const mes = Number(body?.mes);
    const anio = Number(body?.anio);
    const tipoComprobante = String(body?.tipoComprobante ?? "").trim();
    const descripcion = String(body?.descripcion ?? "").trim();
    const fechaStr = String(body?.fecha ?? "").trim();
    const fechaIso = parsearFechaAR(fechaStr);
    if (!fechaIso) {
      return NextResponse.json({ error: "Fecha inválida." }, { status: 400 });
    }

    const facturaProveedor = getFacturaProveedorDelegate();
    if (!facturaProveedor) {
      return NextResponse.json({ error: "Modelo FacturaProveedor no disponible en Prisma Client." }, { status: 500 });
    }

    await ensureFacturaProveedorTable();
    await prisma.$executeRaw`
      UPDATE "FacturaProveedor"
      SET
        "proveedorId" = ${proveedorId},
        "puntoVenta" = ${puntoVenta},
        "nroFactura" = ${nroFactura},
        "cuit" = ${cuit},
        "fecha" = ${new Date(fechaIso)},
        "descripcion" = ${descripcion},
        "tipoComprobante" = ${tipoComprobante},
        "importe" = ${importe},
        "mes" = ${mes},
        "anio" = ${anio},
        "updatedAt" = NOW()
      WHERE "id" = ${facturaId}
    `;
    const rows = await prisma.$queryRaw<FacturaRow[]>`
      SELECT
        "id", "mes", "anio", "proveedorId", "puntoVenta", "nroFactura", "cuit",
        "fecha", "descripcion", "tipoComprobante", "importe", "createdAt", "updatedAt"
      FROM "FacturaProveedor"
      WHERE "id" = ${facturaId}
      LIMIT 1
    `;
    const hydrated = await hydrateFactura(rows[0]);
    if (!hydrated) return NextResponse.json({ error: "Factura no encontrada." }, { status: 404 });
    return NextResponse.json(hydrated);
  } catch {
    return NextResponse.json({ error: "Error al actualizar factura." }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const roles = (session?.user as { roles?: string[] })?.roles ?? [];
  if (!canAccess(roles)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { id } = await params;
  const facturaId = Number(id);
  if (!Number.isInteger(facturaId)) {
    return NextResponse.json({ error: "ID inválido." }, { status: 400 });
  }
  try {
    await ensureFacturaProveedorTable();
    await prisma.$executeRaw`
      DELETE FROM "FacturaProveedor"
      WHERE "id" = ${facturaId}
    `;
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Error al eliminar factura." }, { status: 500 });
  }
}
