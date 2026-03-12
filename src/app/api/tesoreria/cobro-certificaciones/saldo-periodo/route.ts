import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const ROLES = ["ADMIN", "TESORERO", "SUPER_ADMIN"] as const;

function canAccess(roles: string[]) {
  return ROLES.some((r) => roles.includes(r));
}

function parseFechaDDMMYYYY(str: string): Date | null {
  const trimmed = (str ?? "").trim();
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(trimmed);
  if (!match) return null;
  const [, d, m, y] = match;
  const day = parseInt(d!, 10);
  const month = parseInt(m!, 10) - 1;
  const year = parseInt(y!, 10);
  if (month < 0 || month > 11 || day < 1 || day > 31) return null;
  return new Date(year, month, day, 0, 0, 0, 0);
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
  const mes = parseInt(searchParams.get("mes") ?? "0", 10);
  const anio = parseInt(searchParams.get("anio") ?? "0", 10);

  if (!desdeStr || !hastaStr) {
    return NextResponse.json(
      { error: "desde y hasta son obligatorios (DD/MM/YYYY)" },
      { status: 400 }
    );
  }

  const fechaDesde = parseFechaDDMMYYYY(desdeStr);
  const fechaHasta = parseFechaDDMMYYYY(hastaStr);
  if (!fechaDesde || !fechaHasta) {
    return NextResponse.json(
      { error: "Fechas inválidas. Usar DD/MM/YYYY" },
      { status: 400 }
    );
  }

  if (fechaDesde > fechaHasta) {
    return NextResponse.json(
      { error: "La fecha Desde debe ser menor o igual que Hasta" },
      { status: 400 }
    );
  }

  const movimientos = await prisma.cobroCertificacion.findMany({
    where: {
      mes,
      anio,
      fecha: {
        gte: fechaDesde,
        lte: new Date(fechaHasta.getTime() + 24 * 60 * 60 * 1000 - 1),
      },
    },
    orderBy: [{ fecha: "asc" }, { createdAt: "asc" }],
  });

  const saldoTotal = movimientos.reduce((sum, m) => sum + Number(m.importe), 0);

  return NextResponse.json({
    saldoTotal: Math.round(saldoTotal * 100) / 100,
    cantidadMovimientos: movimientos.length,
  });
}
