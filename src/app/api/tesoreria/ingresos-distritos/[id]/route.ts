import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Decimal } from "@prisma/client/runtime/library";
import { registrarAuditoria } from "@/lib/auditoria";
import { recalcularSaldosIngresosDistritos } from "@/lib/tesoreria/recalcularSaldosIngresosDistritos";
import { parsearConceptoIngresoDistrito } from "@/lib/tesoreria/parsearConceptoIngresoDistrito";

const ROLES = ["ADMIN", "TESORERO", "SUPER_ADMIN"] as const;

function canAccess(roles: string[]) {
  return ROLES.some((r) => roles.includes(r));
}

function parseFechaDDMMYYYY(str: string): Date {
  const raw = (str ?? "").trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return new Date(raw);
  const [d, m, y] = raw.split("/");
  if (!d || !m || !y) return new Date();
  return new Date(
    `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}T12:00:00.000-03:00`
  );
}

/** PUT - Actualizar registro; recalcula saldos del período */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const roles = (session?.user as { roles?: string[] })?.roles ?? [];
  if (!canAccess(roles)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const idParam = (await params).id;
  const id = parseInt(idParam, 10);
  if (!idParam || Number.isNaN(id)) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }

  const reg = await prisma.ingresoDistrito.findUnique({ where: { id } });
  if (!reg) {
    return NextResponse.json({ error: "Registro no encontrado" }, { status: 404 });
  }

  let body: {
    fecha?: string;
    recibo?: string | null;
    distrito?: string | null;
    concepto?: string;
    periodo?: string | null;
    ctaColeg?: number | null;
    nMatriculados?: number | null;
    importe?: number;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
  }

  const concepto = (body.concepto ?? reg.concepto).trim();
  const importeVal =
    body.importe !== undefined ? Number(body.importe) : Number(reg.importe);
  const fechaStr = body.fecha;
  const fecha = fechaStr ? parseFechaDDMMYYYY(fechaStr) : reg.fecha;

  let ctaColeg: number | null = body.ctaColeg !== undefined ? Number(body.ctaColeg) : null;
  let nMatriculados: number | null = body.nMatriculados !== undefined ? Number(body.nMatriculados) : null;
  if (ctaColeg === null && nMatriculados === null) {
    const parsed = parsearConceptoIngresoDistrito(concepto, importeVal);
    ctaColeg = parsed.ctaColeg;
    nMatriculados = parsed.nMatriculados;
  }
  if (Number.isNaN(ctaColeg!)) ctaColeg = null;
  if (Number.isNaN(nMatriculados!)) nMatriculados = null;

  const periodoData =
    body.periodo !== undefined
      ? (String(body.periodo).trim() || null)
      : undefined;

  await prisma.ingresoDistrito.update({
    where: { id },
    data: {
      fecha,
      recibo: body.recibo !== undefined ? (body.recibo?.trim() || null) : reg.recibo,
      distrito: body.distrito !== undefined ? (body.distrito?.trim() || null) : reg.distrito,
      concepto,
      ...(periodoData !== undefined ? { periodo: periodoData } : {}),
      ctaColeg: ctaColeg != null ? new Decimal(ctaColeg) : null,
      nMatriculados: nMatriculados != null ? new Decimal(nMatriculados) : null,
      importe: new Decimal(importeVal),
    },
  });

  await recalcularSaldosIngresosDistritos(prisma, reg.mes, reg.anio);

  const user = session?.user as { id?: string; name?: string; email?: string };
  try {
    await registrarAuditoria({
      userId: user?.id ?? "",
      userNombre: user?.name ?? "",
      userEmail: user?.email ?? "",
      accion: "Actualizó registro de Ingresos Distritos",
      modulo: "Tesorería",
      detalle: String(id),
    });
  } catch {}

  const actualizado = await prisma.ingresoDistrito.findUnique({ where: { id } });
  const r = actualizado!;
  return NextResponse.json({
    ...r,
    ctaColeg: r.ctaColeg != null ? Number(r.ctaColeg) : null,
    nMatriculados: r.nMatriculados != null ? Number(r.nMatriculados) : null,
    importe: Number(r.importe),
    saldo: Number(r.saldo),
  });
}

/** DELETE - Eliminar registro; recalcula saldos */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const roles = (session?.user as { roles?: string[] })?.roles ?? [];
  if (!canAccess(roles)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const idParam = (await params).id;
  const id = parseInt(idParam, 10);
  if (!idParam || Number.isNaN(id)) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }

  const reg = await prisma.ingresoDistrito.findUnique({ where: { id } });
  if (!reg) {
    return NextResponse.json({ error: "Registro no encontrado" }, { status: 404 });
  }

  await prisma.ingresoDistrito.delete({ where: { id } });
  await recalcularSaldosIngresosDistritos(prisma, reg.mes, reg.anio);

  const user = session?.user as { id?: string; name?: string; email?: string };
  try {
    await registrarAuditoria({
      userId: user?.id ?? "",
      userNombre: user?.name ?? "",
      userEmail: user?.email ?? "",
      accion: "Eliminó registro de Ingresos Distritos",
      modulo: "Tesorería",
      detalle: String(id),
    });
  } catch {}

  return new NextResponse(null, { status: 204 });
}
