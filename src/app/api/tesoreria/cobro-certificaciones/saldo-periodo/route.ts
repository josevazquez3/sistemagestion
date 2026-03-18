import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parsearFechaSegura } from "@/lib/utils/fecha";

const ROLES = ["ADMIN", "TESORERO", "SUPER_ADMIN"] as const;

function canAccess(roles: string[]) {
  return ROLES.some((r) => roles.includes(r));
}

/** GET - Saldo total del período (suma de importes de movimientos en rango de fechas) */
export async function GET(req: NextRequest) {
  const session = await auth();
  const roles = (session?.user as { roles?: string[] })?.roles ?? [];
  if (!canAccess(roles)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const desdeStr = searchParams.get("desde")?.trim();
  const hastaStr = searchParams.get("hasta")?.trim();
  // Nota: los parámetros mes/anio pueden seguir viniendo desde el frontend
  // pero son legacy y NO deben usarse para filtrar. El único criterio de
  // filtrado es el rango de fechas [desde, hasta] en timezone AR.

  if (!desdeStr || !hastaStr) {
    return NextResponse.json(
      { error: "desde y hasta son obligatorios (DD/MM/YYYY)" },
      { status: 400 }
    );
  }

  const fechaDesdeUTC = parsearFechaSegura(desdeStr);
  const fechaHastaUTC = parsearFechaSegura(hastaStr);
  if (!fechaDesdeUTC || !fechaHastaUTC) {
    return NextResponse.json(
      { error: "Fechas inválidas. Usar DD/MM/YYYY" },
      { status: 400 }
    );
  }

  if (fechaDesdeUTC > fechaHastaUTC) {
    return NextResponse.json(
      { error: "La fecha Desde debe ser menor o igual que Hasta" },
      { status: 400 }
    );
  }

  const movimientos = await prisma.cobroCertificacion.findMany({
    where: {
      fecha: {
        gte: fechaDesdeUTC,
        lte: fechaHastaUTC,
      },
    },
    orderBy: [{ fecha: "asc" }, { createdAt: "asc" }],
  });

  const saldoTotal = movimientos.reduce((sum, m) => sum + Number(m.importe), 0);

  const movimientosDelRango = movimientos.map((m) => ({
    fecha: m.fecha,
    concepto: m.concepto,
    importe: Number(m.importe),
    saldo: Number(m.saldo),
  }));

  return NextResponse.json({
    saldoTotal: Math.round(saldoTotal * 100) / 100,
    cantidadMovimientos: movimientos.length,
    movimientos: movimientosDelRango,
  });
}
