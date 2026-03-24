import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Decimal } from "@prisma/client/runtime/library";
import { canAccess, ensureInformeTables, getRolesFromSession, parseId } from "../../_shared";

export async function POST(
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

  let body: { numero?: string | null; concepto?: string; importe?: number; orden?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
  }

  const concepto = (body.concepto ?? "").trim();
  const importe = Number(body.importe);
  const orden = Number(body.orden ?? 0);
  if (!concepto) {
    return NextResponse.json({ error: "concepto es obligatorio" }, { status: 400 });
  }
  if (Number.isNaN(importe)) {
    return NextResponse.json({ error: "importe inválido" }, { status: 400 });
  }
  if (Number.isNaN(orden)) {
    return NextResponse.json({ error: "orden inválido" }, { status: 400 });
  }

  try {
    const parent = await prisma.informeTesoreria.findUnique({ where: { id: informeId } });
    if (!parent) return NextResponse.json({ error: "Informe no encontrado" }, { status: 404 });

    const created = await prisma.informeCompromiso.create({
      data: {
        informeId,
        numero: body.numero?.trim() ? body.numero.trim() : null,
        concepto,
        importe: new Decimal(importe),
        orden,
      },
    });
    return NextResponse.json({ ...created, importe: Number(created.importe) }, { status: 201 });
  } catch (err) {
    console.error("informe/[id]/compromisos POST:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error al crear compromiso" },
      { status: 500 }
    );
  }
}
