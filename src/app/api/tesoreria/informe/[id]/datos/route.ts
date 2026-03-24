import { NextRequest, NextResponse } from "next/server";
import { computeInformeDatos } from "@/lib/tesoreria/computeInformeDatos";
import {
  canAccess,
  ensureInformeTables,
  getRolesFromSession,
  parseDateOrNull,
  parseId,
} from "../../_shared";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const roles = await getRolesFromSession();
  if (!canAccess(roles)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }
  await ensureInformeTables();

  const id = parseId((await params).id);
  if (id == null) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

  const { searchParams } = new URL(req.url);
  const fechaDesde = parseDateOrNull(searchParams.get("fechaDesde"));
  const fechaHasta = parseDateOrNull(searchParams.get("fechaHasta"));
  if (!fechaDesde || !fechaHasta) {
    return NextResponse.json(
      { error: "fechaDesde y fechaHasta son obligatorias (YYYY-MM-DD)" },
      { status: 400 }
    );
  }
  if (fechaDesde.getTime() > fechaHasta.getTime()) {
    return NextResponse.json(
      { error: "fechaDesde no puede ser mayor a fechaHasta" },
      { status: 400 }
    );
  }

  const certDesde = parseDateOrNull(searchParams.get("certDesde")) ?? fechaDesde;
  const certHasta = parseDateOrNull(searchParams.get("certHasta")) ?? fechaHasta;
  if (certDesde.getTime() > certHasta.getTime()) {
    return NextResponse.json(
      { error: "certDesde no puede ser mayor a certHasta" },
      { status: 400 }
    );
  }

  try {
    const payload = await computeInformeDatos({
      informeId: id,
      fechaDesde,
      fechaHasta,
      certDesde,
      certHasta,
    });
    return NextResponse.json(payload);
  } catch (err) {
    console.error("informe/[id]/datos GET:", err);
    if (err instanceof Error && err.message === "Informe no encontrado") {
      return NextResponse.json({ error: "Informe no encontrado" }, { status: 404 });
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error al calcular datos del informe" },
      { status: 500 }
    );
  }
}
