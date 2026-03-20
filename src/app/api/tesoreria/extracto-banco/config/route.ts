import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { registrarAuditoria } from "@/lib/auditoria";

const ROLES = ["ADMIN", "TESORERO", "SUPER_ADMIN"] as const;
const TZ = "America/Argentina/Buenos_Aires";

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

function formatDateToDDMMYYYYAR(date: Date): string {
  return date.toLocaleDateString("es-AR", {
    timeZone: TZ,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/** GET - Obtener configuración global de Extracto Banco (saldo inicial y fecha) */
export async function GET() {
  const session = await auth();
  const roles = (session?.user as { roles?: string[] })?.roles ?? [];
  if (!canAccess(roles)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const config = await prisma.extractoBancoConfig.findFirst();
  const saldoInicial = config ? Number(config.saldoInicial) : 0;
  const fechaSaldoInicial =
    config?.fechaSaldoInicial != null
      ? formatDateToDDMMYYYYAR(config.fechaSaldoInicial)
      : null;

  return NextResponse.json({ saldoInicial, fechaSaldoInicial });
}

/** PUT - Crear o actualizar configuración (saldoInicial >= 0, fechaSaldoInicial opcional DD/MM/YYYY) */
export async function PUT(req: NextRequest) {
  const session = await auth();
  const roles = (session?.user as { roles?: string[] })?.roles ?? [];
  if (!canAccess(roles)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  let body: { saldoInicial?: number; fechaSaldoInicial?: string | null };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
  }

  const rawSaldo = body.saldoInicial;
  const saldoInicial = Number(rawSaldo);
  if (
    rawSaldo == null ||
    Number.isNaN(saldoInicial) ||
    saldoInicial < 0
  ) {
    return NextResponse.json(
      { error: "saldoInicial debe ser un número mayor o igual a 0" },
      { status: 400 }
    );
  }

  let fechaSaldoInicialDate: Date | null = null;
  const rawFecha = body.fechaSaldoInicial;
  if (rawFecha != null && rawFecha !== "") {
    const trimmed = String(rawFecha).trim();
    const comp = parseFechaComponentes(trimmed);
    if (!comp) {
      return NextResponse.json(
        { error: "fechaSaldoInicial debe ser una fecha válida en formato DD/MM/YYYY" },
        { status: 400 }
      );
    }
    fechaSaldoInicialDate = buildDateInARTz(
      comp.year,
      comp.monthIndex,
      comp.day,
      0,
      0,
      0,
      0
    );
  }

  const existente = await prisma.extractoBancoConfig.findFirst();
  const data = {
    saldoInicial,
    fechaSaldoInicial: fechaSaldoInicialDate,
  };

  const config = existente
    ? await prisma.extractoBancoConfig.update({
        where: { id: existente.id },
        data,
      })
    : await prisma.extractoBancoConfig.create({ data });

  const user = session?.user as { id?: string; name?: string; email?: string };
  try {
    await registrarAuditoria({
      userId: user?.id ?? "",
      userNombre: user?.name ?? "",
      userEmail: user?.email ?? "",
      accion: `Actualizó saldo inicial Extracto Banco a $${saldoInicial.toFixed(2)}${fechaSaldoInicialDate ? ` (${formatDateToDDMMYYYYAR(fechaSaldoInicialDate)})` : ""}`,
      modulo: "Tesorería",
      detalle: String(config.id),
    });
  } catch {}

  const fechaSaldoInicialResp =
    config.fechaSaldoInicial != null
      ? formatDateToDDMMYYYYAR(config.fechaSaldoInicial)
      : null;

  return NextResponse.json({
    saldoInicial: Number(config.saldoInicial),
    fechaSaldoInicial: fechaSaldoInicialResp,
  });
}
