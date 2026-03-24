import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { fechaSeguraParaPrisma, parsearFechaSegura } from "@/lib/utils/fecha";
import {
  findMayorCuentaById,
  findMayorMovimientoByOrigen,
  insertMayorMovimiento,
  listMayorMovimientosEnRango,
} from "@/lib/tesoreria/mayorRawQueries";
import { aprenderReglasMayorDesdeConcepto } from "@/lib/tesoreria/mayorReglasAprendizaje";

const ROLES = ["ADMIN", "TESORERO", "SUPER_ADMIN"] as const;

const ORIGENES = ["EXTRACTO", "FONDO_FIJO", "MANUAL"] as const;
type Origen = (typeof ORIGENES)[number];

function canAccess(roles: string[]) {
  return ROLES.some((r) => roles.includes(r));
}

function serialize(m: {
  id: number;
  cuentaId: number;
  fecha: Date | null;
  concepto: string;
  importe: number;
  origen: string;
  origenId: number | null;
  createdAt: Date;
  cuentaNombre: string;
}) {
  return {
    id: m.id,
    cuentaId: m.cuentaId,
    cuentaNombre: m.cuentaNombre,
    fecha: m.fecha ? m.fecha.toISOString() : null,
    concepto: m.concepto,
    importe: m.importe,
    origen: m.origen,
    origenId: m.origenId,
    createdAt: m.createdAt.toISOString(),
  };
}

/** GET ?desde=YYYY-MM-DD&hasta=YYYY-MM-DD (o DD/MM/YYYY) — rango inclusive */
export async function GET(req: NextRequest) {
  const session = await auth();
  const roles = (session?.user as { roles?: string[] })?.roles ?? [];
  if (!canAccess(roles)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  let desdeStr = searchParams.get("desde")?.trim() ?? "";
  let hastaStr = searchParams.get("hasta")?.trim() ?? "";

  function parseParam(s: string): Date | null {
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return fechaSeguraParaPrisma(s);
    return parsearFechaSegura(s);
  }

  let inicio = parseParam(desdeStr);
  let fin = parseParam(hastaStr);

  if (!inicio || !fin) {
    const mes = parseInt(searchParams.get("mes") ?? "0", 10);
    const anio = parseInt(searchParams.get("anio") ?? "0", 10);
    if (mes >= 1 && mes <= 12 && anio > 0) {
      inicio = new Date(Date.UTC(anio, mes - 1, 1, 12, 0, 0, 0));
      fin = new Date(Date.UTC(anio, mes, 0, 12, 0, 0, 0));
    }
  }

  if (!inicio || !fin) {
    return NextResponse.json(
      { error: "desde y hasta son obligatorios (YYYY-MM-DD o DD/MM/YYYY)" },
      { status: 400 }
    );
  }

  if (inicio.getTime() > fin.getTime()) {
    return NextResponse.json(
      { error: "desde no puede ser posterior a hasta" },
      { status: 400 }
    );
  }

  try {
    const rows = await listMayorMovimientosEnRango(inicio, fin);
    return NextResponse.json(rows.map(serialize));
  } catch (err) {
    console.error("mayor-movimientos GET:", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Error al listar (¿migración aplicada?)",
      },
      { status: 500 }
    );
  }
}

/** POST — manual o desde extracto/fondo */
export async function POST(req: NextRequest) {
  const session = await auth();
  const roles = (session?.user as { roles?: string[] })?.roles ?? [];
  if (!canAccess(roles)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  let body: {
    cuentaId?: number;
    fecha?: string | null;
    concepto?: string;
    importe?: number;
    origen?: string;
    origenId?: number | null;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
  }

  const cuentaId = Number(body.cuentaId);
  if (!cuentaId || Number.isNaN(cuentaId)) {
    return NextResponse.json({ error: "cuentaId inválido" }, { status: 400 });
  }

  const cuenta = await findMayorCuentaById(cuentaId);
  if (!cuenta) {
    return NextResponse.json({ error: "Cuenta no encontrada" }, { status: 400 });
  }

  const origen = (body.origen ?? "MANUAL").toUpperCase() as Origen;
  if (!ORIGENES.includes(origen)) {
    return NextResponse.json({ error: "origen inválido" }, { status: 400 });
  }

  const concepto = (body.concepto ?? "").trim();
  if (!concepto) {
    return NextResponse.json({ error: "concepto es obligatorio" }, { status: 400 });
  }

  const importe = Number(body.importe);
  if (Number.isNaN(importe)) {
    return NextResponse.json({ error: "importe inválido" }, { status: 400 });
  }

  const origenId =
    body.origenId !== undefined && body.origenId !== null
      ? Number(body.origenId)
      : null;

  if (origen === "EXTRACTO" || origen === "FONDO_FIJO") {
    if (origenId == null || Number.isNaN(origenId)) {
      return NextResponse.json(
        { error: "origenId es obligatorio para EXTRACTO y FONDO_FIJO" },
        { status: 400 }
      );
    }
    const dup = await findMayorMovimientoByOrigen(origen, origenId);
    if (dup) {
      return NextResponse.json(
        { error: "Este movimiento ya está asignado a un mayor" },
        { status: 409 }
      );
    }
  }

  if (!body.fecha) {
    return NextResponse.json({ error: "fecha es obligatoria" }, { status: 400 });
  }
  const fecha = fechaSeguraParaPrisma(body.fecha);

  try {
    const creado = await insertMayorMovimiento({
      cuentaId,
      fecha,
      concepto,
      importe,
      origen,
      origenId,
    });
    if (origen === "EXTRACTO" || origen === "FONDO_FIJO") {
      try {
        await aprenderReglasMayorDesdeConcepto(concepto, cuentaId);
      } catch (learnErr) {
        console.error("mayor-movimientos aprendizaje reglas:", learnErr);
      }
    }
    return NextResponse.json(serialize(creado));
  } catch (err) {
    console.error("mayor-movimientos POST:", err);
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("Unique") || msg.includes("unique")) {
      return NextResponse.json(
        { error: "Este movimiento ya está asignado a un mayor" },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: msg || "Error al crear" }, { status: 500 });
  }
}
