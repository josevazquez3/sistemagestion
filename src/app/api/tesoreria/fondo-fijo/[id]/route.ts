import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Decimal } from "@prisma/client/runtime/library";
import { registrarAuditoria } from "@/lib/auditoria";
import { recalcularSaldos } from "@/lib/tesoreria/recalcularSaldosFondoFijo";

const ROLES = ["ADMIN", "TESORERO", "SUPER_ADMIN"] as const;

function canAccess(roles: string[]) {
  return ROLES.some((r) => roles.includes(r));
}

function parseId(id: string): number | null {
  const n = parseInt(id, 10);
  return isNaN(n) ? null : n;
}

/** PUT - Actualizar movimiento; recalcula saldos del período */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const roles = (session?.user as { roles?: string[] })?.roles ?? [];
  if (!canAccess(roles)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const id = parseId((await params).id);
  if (id === null) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }

  const mov = await prisma.fondoFijo.findUnique({ where: { id } });
  if (!mov) {
    return NextResponse.json({ error: "Movimiento no encontrado" }, { status: 404 });
  }

  let body: { fecha?: string; concepto?: string; importePesos?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
  }

  const concepto = (body.concepto ?? mov.concepto).trim();
  const importe = body.importePesos !== undefined ? Number(body.importePesos) : Number(mov.importePesos);
  const fechaStr = (body.fecha ?? "").trim();
  const fecha = fechaStr
    ? new Date(
        /^\d{4}-\d{2}-\d{2}/.test(fechaStr)
          ? fechaStr
          : (() => {
              const [d, m, y] = fechaStr.split("/");
              return `${y}-${m!.padStart(2, "0")}-${d!.padStart(2, "0")}T12:00:00.000-03:00`;
            })()
      )
    : mov.fecha;

  await prisma.fondoFijo.update({
    where: { id },
    data: {
      fecha,
      concepto,
      importePesos: new Decimal(importe),
    },
  });

  await recalcularSaldos(prisma, mov.mes, mov.anio);

  const user = session?.user as { id?: string; name?: string; email?: string };
  try {
    await registrarAuditoria({
      userId: user?.id ?? "",
      userNombre: user?.name ?? "",
      userEmail: user?.email ?? "",
      accion: "Actualizó movimiento del Fondo Fijo",
      modulo: "Tesorería",
      detalle: String(id),
    });
  } catch {}

  const actualizado = await prisma.fondoFijo.findUnique({ where: { id } });
  return NextResponse.json({
    ...actualizado,
    importePesos: Number(actualizado!.importePesos),
    saldoPesos: Number(actualizado!.saldoPesos),
  });
}

/** DELETE - Eliminar movimiento; recalcula saldos */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const roles = (session?.user as { roles?: string[] })?.roles ?? [];
  if (!canAccess(roles)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const id = parseId((await params).id);
  if (id === null) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }

  const mov = await prisma.fondoFijo.findUnique({ where: { id } });
  if (!mov) {
    return NextResponse.json({ error: "Movimiento no encontrado" }, { status: 404 });
  }

  await prisma.fondoFijo.delete({ where: { id } });
  await recalcularSaldos(prisma, mov.mes, mov.anio);

  const user = session?.user as { id?: string; name?: string; email?: string };
  try {
    await registrarAuditoria({
      userId: user?.id ?? "",
      userNombre: user?.name ?? "",
      userEmail: user?.email ?? "",
      accion: "Eliminó movimiento del Fondo Fijo",
      modulo: "Tesorería",
      detalle: String(id),
    });
  } catch {}

  return new NextResponse(null, { status: 204 });
}
