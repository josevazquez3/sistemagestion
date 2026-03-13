import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const ROLES = ["ADMIN", "TESORERO", "SUPER_ADMIN"] as const;

function canAccess(roles: string[]) {
  return ROLES.some((r) => roles.includes(r));
}

function parseFechaComponentes(str: string): { day: number; monthIndex: number; year: number } | null {
  const trimmed = (str ?? "").trim();
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(trimmed);
  if (!match) return null;
  const [, d, m, y] = match;
  const day = parseInt(d!, 10);
  const monthIndex = parseInt(m!, 10) - 1;
  const year = parseInt(y!, 10);
  if (monthIndex < 0 || monthIndex > 11 || day < 1 || day > 31) return null;
  return { day, monthIndex, year };
}

function buildDateInARTz(
  year: number,
  monthIndex: number,
  day: number,
  hours: number,
  minutes: number,
  seconds: number,
  ms: number
): Date {
  const yyyy = String(year).padStart(4, "0");
  const mm = String(monthIndex + 1).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  const hh = String(hours).padStart(2, "0");
  const mi = String(minutes).padStart(2, "0");
  const ss = String(seconds).padStart(2, "0");
  const mss = String(ms).padStart(3, "0");
  const iso = `${yyyy}-${mm}-${dd}T${hh}:${mi}:${ss}.${mss}-03:00`;
  return new Date(iso);
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

  const desdeComp = parseFechaComponentes(desdeStr);
  const hastaComp = parseFechaComponentes(hastaStr);
  if (!desdeComp || !hastaComp) {
    return NextResponse.json(
      { error: "Fechas inválidas. Usar DD/MM/YYYY" },
      { status: 400 }
    );
  }

  const fechaDesdeUTC = buildDateInARTz(
    desdeComp.year,
    desdeComp.monthIndex,
    desdeComp.day,
    0,
    0,
    0,
    0
  );
  const fechaHastaUTC = buildDateInARTz(
    hastaComp.year,
    hastaComp.monthIndex,
    hastaComp.day,
    23,
    59,
    59,
    999
  );

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
