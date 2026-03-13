import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { registrarAuditoria } from "@/lib/auditoria";
import type { Prisma } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";

const ROLES = ["ADMIN", "TESORERO", "SUPER_ADMIN"] as const;

function canAccess(roles: string[]) {
  return ROLES.some((r) => roles.includes(r));
}

function parseFechaExtracto(fecha: string): Date {
  const raw = (fecha ?? "").trim();
  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(raw)
    ? `${raw}T12:00:00.000-03:00`
    : raw;
  return new Date(normalized);
}

/** GET - Listar movimientos con filtros y paginación */
export async function GET(req: NextRequest) {
  const session = await auth();
  const roles = (session?.user as { roles?: string[] })?.roles ?? [];
  if (!canAccess(roles)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim() ?? "";
  const desde = searchParams.get("desde")?.trim();
  const hasta = searchParams.get("hasta")?.trim();
  const cuentaIdParam = searchParams.get("cuentaId")?.trim();
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const perPage = Math.min(50, Math.max(1, parseInt(searchParams.get("perPage") ?? "20", 10)));

  const where: Prisma.MovimientoExtractoWhereInput = {};

  if (q) {
    where.OR = [
      { concepto: { contains: q, mode: "insensitive" } },
      { referencia: { contains: q, mode: "insensitive" } },
      { descSucursal: { contains: q, mode: "insensitive" } },
    ];
  }

  if (desde || hasta) {
    const fecha: { gte?: Date; lte?: Date } = {};
    const parseFecha = (s: string): Date | null => {
      const parts = s.trim().split("/").map(Number);
      if (parts.length < 3) return null;
      let [d, m, y] = parts;
      if (!d || !m || !y) return null;
      if (y < 100) y += 2000;
      return new Date(y, m - 1, d);
    };
    if (desde) {
      const d = parseFecha(desde);
      if (d) fecha.gte = d;
    }
    if (hasta) {
      const d = parseFecha(hasta);
      if (d) {
        d.setHours(23, 59, 59, 999);
        fecha.lte = d;
      }
    }
    if (fecha.gte !== undefined || fecha.lte !== undefined) where.fecha = fecha;
  }

  if (cuentaIdParam) {
    const cuentaId = parseInt(cuentaIdParam, 10);
    if (!isNaN(cuentaId)) where.cuentaId = cuentaId;
  }

  const [data, total, aggregate] = await Promise.all([
    prisma.movimientoExtracto.findMany({
      where,
      include: { cuenta: true },
      orderBy: [{ fecha: "desc" }, { id: "desc" }],
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    prisma.movimientoExtracto.count({ where }),
    prisma.movimientoExtracto.aggregate({
      where,
      _sum: { importePesos: true },
    }),
  ]);

  const serialized = data.map((m) => ({
    ...m,
    importePesos: Number(m.importePesos),
    saldoPesos: Number(m.saldoPesos),
  }));

  const sumaTotal = aggregate._sum?.importePesos != null ? Number(aggregate._sum.importePesos) : 0;

  return NextResponse.json({ data: serialized, total, page, perPage, sumaTotal });
}

/** DELETE - Eliminar movimientos por IDs (borrado en BDD) */
export async function DELETE(req: NextRequest) {
  const session = await auth();
  const roles = (session?.user as { roles?: string[] })?.roles ?? [];
  if (!canAccess(roles)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  let body: { ids?: number[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido. Se espera { ids: number[] }" }, { status: 400 });
  }

  const ids = Array.isArray(body?.ids) ? body.ids.filter((id) => Number.isInteger(id) && id > 0) : [];
  if (ids.length === 0) {
    return NextResponse.json({ error: "Se requiere un array de ids válidos" }, { status: 400 });
  }

  const result = await prisma.movimientoExtracto.deleteMany({
    where: { id: { in: ids } },
  });

  const user = session?.user as { id?: string; name?: string; email?: string };
  try {
    await registrarAuditoria({
      userId: user?.id ?? "",
      userNombre: user?.name ?? "",
      userEmail: user?.email ?? "",
      accion: "Eliminó movimientos del extracto bancario",
      modulo: "Tesorería",
      detalle: `${result.count} movimiento(s): ${ids.slice(0, 10).join(", ")}${ids.length > 10 ? "…" : ""}`,
    });
  } catch {}

  return NextResponse.json({ ok: true, deleted: result.count });
}

/** POST - Importar movimientos */
export async function POST(req: NextRequest) {
  const session = await auth();
  const roles = (session?.user as { roles?: string[] })?.roles ?? [];
  if (!canAccess(roles)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  let body: Array<{
    fecha: string;
    sucOrigen?: string;
    descSucursal?: string;
    codOperativo?: string;
    referencia?: string;
    concepto: string;
    importePesos: number;
    saldoPesos: number;
    cuentaId?: number | null;
  }>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
  }

  if (!Array.isArray(body) || body.length === 0) {
    return NextResponse.json({ error: "Se requiere un array de movimientos" }, { status: 400 });
  }

  const fechaInvalida = body.find((m) => Number.isNaN(parseFechaExtracto(m.fecha).getTime()));
  if (fechaInvalida) {
    return NextResponse.json({ error: "Hay movimientos con fecha inválida" }, { status: 400 });
  }

  const cuentaId = body[0]?.cuentaId ?? null;
  const fechasParsed = body.map((m) => parseFechaExtracto(m.fecha));
  const primerFechaArchivo = new Date(
    Math.min(...fechasParsed.map((d) => d.getTime()))
  );

  // Inicio del primer día del archivo en ART (00:00 -03:00) para no excluir movimientos del día anterior por timezone
  const artOffsetMs = 3 * 60 * 60 * 1000;
  const artDate = new Date(primerFechaArchivo.getTime() - artOffsetMs);
  const inicioPrimerDiaART = new Date(
    Date.UTC(
      artDate.getUTCFullYear(),
      artDate.getUTCMonth(),
      artDate.getUTCDate(),
      3,
      0,
      0,
      0
    )
  );

  // Último saldo antes del primer día del archivo: solo por cuentaId y fecha (sin codOperativo)
  const where =
    cuentaId != null
      ? { cuentaId, fecha: { lt: inicioPrimerDiaART } }
      : { fecha: { lt: inicioPrimerDiaART } };

  const ultimoMovimiento = await prisma.movimientoExtracto.findFirst({
    where,
    orderBy: [{ fecha: "desc" }, { id: "desc" }],
  });
  const saldoInicial =
    ultimoMovimiento != null ? Number(ultimoMovimiento.saldoPesos) : 0;

  const data = body.map((m) => ({
    fecha: parseFechaExtracto(m.fecha),
    sucOrigen: m.sucOrigen ?? null,
    descSucursal: m.descSucursal ?? null,
    codOperativo: m.codOperativo ?? null,
    referencia: m.referencia ?? null,
    concepto: m.concepto ?? "",
    importePesos: new Decimal(m.importePesos ?? 0),
    saldoPesos: new Decimal(0),
    cuentaId: m.cuentaId ?? null,
    importado: true,
  }));

  data.sort((a, b) => a.fecha.getTime() - b.fecha.getTime());

  let saldoAcumulado = saldoInicial;
  for (const fila of data) {
    const importe = Number(fila.importePesos);
    saldoAcumulado += importe;
    fila.saldoPesos = new Decimal(Math.round(saldoAcumulado * 100) / 100);
  }

  await prisma.movimientoExtracto.createMany({ data });
  const count = data.length;

  const user = session?.user as { id?: string; name?: string; email?: string };
  try {
    await registrarAuditoria({
      userId: user?.id ?? "",
      userNombre: user?.name ?? "",
      userEmail: user?.email ?? "",
      accion: `Importó ${count} movimientos del extracto bancario`,
      modulo: "Tesorería",
      detalle: String(count),
    });
  } catch {}

  return NextResponse.json({ ok: true, count, mensaje: `${count} movimientos importados correctamente.` });
}
