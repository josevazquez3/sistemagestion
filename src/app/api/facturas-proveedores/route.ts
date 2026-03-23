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

async function hydrateFacturas(rows: FacturaRow[]) {
  const ids = [...new Set(rows.map((r) => r.proveedorId))];
  const proveedores = ids.length
    ? await prisma.proveedor.findMany({ where: { id: { in: ids } } })
    : [];
  const byId = new Map(proveedores.map((p) => [p.id, p]));
  return rows.map((r) => ({
    ...r,
    fecha: r.fecha.toISOString(),
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
    proveedor: byId.get(r.proveedorId) ?? null,
  }));
}

export async function GET(req: NextRequest) {
  const session = await auth();
  const roles = (session?.user as { roles?: string[] })?.roles ?? [];
  if (!canAccess(roles)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const mes = Number(searchParams.get("mes"));
  const anio = Number(searchParams.get("anio"));
  if (!Number.isInteger(mes) || mes < 1 || mes > 12 || !Number.isInteger(anio)) {
    return NextResponse.json({ error: "Parámetros inválidos." }, { status: 400 });
  }

  await ensureFacturaProveedorTable();
  const rows = await prisma.$queryRaw<FacturaRow[]>`
    SELECT
      "id", "mes", "anio", "proveedorId", "puntoVenta", "nroFactura", "cuit",
      "fecha", "descripcion", "tipoComprobante", "importe", "createdAt", "updatedAt"
    FROM "FacturaProveedor"
    WHERE "mes" = ${mes} AND "anio" = ${anio}
    ORDER BY "createdAt" ASC
  `;
  return NextResponse.json(await hydrateFacturas(rows));
}

export async function POST(req: NextRequest) {
  const session = await auth();
  const roles = (session?.user as { roles?: string[] })?.roles ?? [];
  if (!canAccess(roles)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
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

    if (
      !Number.isInteger(proveedorId) ||
      !Number.isInteger(puntoVenta) ||
      !Number.isInteger(nroFactura) ||
      !cuit ||
      Number.isNaN(importe)
    ) {
      return NextResponse.json({ error: "Faltan campos obligatorios." }, { status: 400 });
    }
    if (!Number.isInteger(mes) || mes < 1 || mes > 12 || !Number.isInteger(anio)) {
      return NextResponse.json({ error: "Mes/Año inválidos." }, { status: 400 });
    }

    const fechaIso = parsearFechaAR(fechaStr);
    if (!fechaIso) {
      return NextResponse.json({ error: "Fecha inválida." }, { status: 400 });
    }

    await ensureFacturaProveedorTable();
    const inserted = await prisma.$queryRaw<{ id: number }[]>`
      INSERT INTO "FacturaProveedor"
        ("mes","anio","proveedorId","puntoVenta","nroFactura","cuit","fecha","descripcion","tipoComprobante","importe","updatedAt")
      VALUES
        (${mes}, ${anio}, ${proveedorId}, ${puntoVenta}, ${nroFactura}, ${cuit}, ${new Date(fechaIso)}, ${descripcion}, ${tipoComprobante}, ${importe}, NOW())
      RETURNING "id"
    `;
    const id = inserted[0]?.id;
    if (!id) return NextResponse.json({ error: "No se pudo crear factura." }, { status: 500 });
    const rows = await prisma.$queryRaw<FacturaRow[]>`
      SELECT
        "id", "mes", "anio", "proveedorId", "puntoVenta", "nroFactura", "cuit",
        "fecha", "descripcion", "tipoComprobante", "importe", "createdAt", "updatedAt"
      FROM "FacturaProveedor"
      WHERE "id" = ${id}
      LIMIT 1
    `;
    const hydrated = await hydrateFacturas(rows);
    return NextResponse.json(hydrated[0], { status: 201 });
  } catch {
    return NextResponse.json({ error: "Error al crear factura." }, { status: 500 });
  }
}
