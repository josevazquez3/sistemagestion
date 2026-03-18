import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parsearFechaSegura } from "@/lib/utils/fecha";

const ROLES = ["ADMIN", "TESORERO", "SUPER_ADMIN"] as const;

function canAccess(roles: string[]) {
  return ROLES.some((r) => roles.includes(r));
}

/** POST - Guardar comisión de certificaciones */
export async function POST(req: NextRequest) {
  const session = await auth();
  const roles = (session?.user as { roles?: string[] })?.roles ?? [];
  if (!canAccess(roles)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  let body: {
    mes?: number;
    anio?: number;
    fechaDesde?: string;
    fechaHasta?: string;
    saldoPeriodo?: number;
    porcentaje?: number;
    totalComision?: number;
    legajos?: { legajoId: string; nombre: string; monto: number }[];
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
  }

  const mes = body.mes ?? 0;
  const anio = body.anio ?? 0;
  if (!mes || !anio || mes < 1 || mes > 12) {
    return NextResponse.json({ error: "mes y anio son obligatorios" }, { status: 400 });
  }

  const fechaDesde = body.fechaDesde ? parsearFechaSegura(body.fechaDesde) : null;
  const fechaHasta = body.fechaHasta ? parsearFechaSegura(body.fechaHasta) : null;
  if (!fechaDesde || !fechaHasta) {
    return NextResponse.json({ error: "fechaDesde y fechaHasta obligatorios (DD/MM/YYYY)" }, { status: 400 });
  }

  const saldoPeriodo = Number(body.saldoPeriodo ?? 0);
  const porcentaje = Number(body.porcentaje ?? 0);
  const totalComision = Number(body.totalComision ?? 0);
  const legajos = Array.isArray(body.legajos) ? body.legajos : [];

  const creado = await prisma.comisionCertificacion.create({
    data: {
      mes,
      anio,
      fechaDesde,
      fechaHasta,
      saldoPeriodo,
      porcentaje,
      totalComision,
      legajos: legajos as object,
    },
  });

  return NextResponse.json(creado, { status: 201 });
}
