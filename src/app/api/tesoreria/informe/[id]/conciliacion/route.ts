import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Decimal } from "@prisma/client/runtime/library";
import { canAccess, ensureInformeTables, getRolesFromSession, parseId } from "../../_shared";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const roles = await getRolesFromSession();
  if (!canAccess(roles)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }
  await ensureInformeTables();
  const informeId = parseId((await params).id);
  if (informeId == null) {
    return NextResponse.json({ error: "ID de informe inválido" }, { status: 400 });
  }

  let body: {
    chequesADepositar?: number;
    saldoBancoRioOverride?: number | null;
    saldoFondoFijoOverride?: number | null;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
  }

  const data: {
    chequesADepositar?: Decimal | null;
    saldoBancoRioOverride?: Decimal | null;
    saldoFondoFijoOverride?: Decimal | null;
  } = {};

  if (body.chequesADepositar !== undefined) {
    const n = Number(body.chequesADepositar);
    if (Number.isNaN(n)) {
      return NextResponse.json({ error: "chequesADepositar inválido" }, { status: 400 });
    }
    data.chequesADepositar = new Decimal(n);
  }
  if (body.saldoBancoRioOverride !== undefined) {
    if (body.saldoBancoRioOverride == null) data.saldoBancoRioOverride = null;
    else {
      const n = Number(body.saldoBancoRioOverride);
      if (Number.isNaN(n)) {
        return NextResponse.json({ error: "saldoBancoRioOverride inválido" }, { status: 400 });
      }
      data.saldoBancoRioOverride = new Decimal(n);
    }
  }
  if (body.saldoFondoFijoOverride !== undefined) {
    if (body.saldoFondoFijoOverride == null) data.saldoFondoFijoOverride = null;
    else {
      const n = Number(body.saldoFondoFijoOverride);
      if (Number.isNaN(n)) {
        return NextResponse.json({ error: "saldoFondoFijoOverride inválido" }, { status: 400 });
      }
      data.saldoFondoFijoOverride = new Decimal(n);
    }
  }

  try {
    const prismaAny = prisma as any;
    const updated = await prismaAny.informeTesoreria.update({
      where: { id: informeId },
      data,
      select: {
        id: true,
        chequesADepositar: true,
        saldoBancoRioOverride: true,
        saldoFondoFijoOverride: true,
      },
    });
    return NextResponse.json({
      ...updated,
      chequesADepositar:
        updated.chequesADepositar != null ? Number(updated.chequesADepositar) : null,
      saldoBancoRioOverride:
        updated.saldoBancoRioOverride != null
          ? Number(updated.saldoBancoRioOverride)
          : null,
      saldoFondoFijoOverride:
        updated.saldoFondoFijoOverride != null
          ? Number(updated.saldoFondoFijoOverride)
          : null,
    });
  } catch (err: unknown) {
    const code = err && typeof err === "object" && "code" in err ? String((err as { code: string }).code) : "";
    if (code === "P2025") {
      return NextResponse.json({ error: "Informe no encontrado" }, { status: 404 });
    }
    console.error("informe/[id]/conciliacion PUT:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error al guardar conciliación" },
      { status: 500 }
    );
  }
}
