import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { fechaSeguraParaPrisma, parsearFechaSegura } from "@/lib/utils/fecha";
import { ensureMayorTables, findMayorMovimientoByOrigen, insertMayorMovimiento } from "@/lib/tesoreria/mayorRawQueries";
import { matchCuentaPorReglas } from "@/lib/tesoreria/mayorReglasTexto";

const ROLES = ["ADMIN", "TESORERO", "SUPER_ADMIN"] as const;

function canAccess(roles: string[]) {
  return ROLES.some((r) => roles.includes(r));
}

function parseParamFecha(s: string): Date | null {
  const raw = (s ?? "").trim();
  if (!raw) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return fechaSeguraParaPrisma(raw);
  return parsearFechaSegura(raw);
}

/**
 * POST - Re-sincroniza movimientos del Mayor desde Extracto Banco para un período.
 * - Solo crea movimientos si existe una regla que matchee el concepto (mayor_reglas).
 * - No toca Extracto Banco.
 * - Ignora los que ya estén asignados en mayor_movimientos (EXTRACTO + origenId).
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  const roles = (session?.user as { roles?: string[] })?.roles ?? [];
  if (!canAccess(roles)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  let body: { desde?: string; hasta?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
  }

  const desde = parseParamFecha(body.desde ?? "");
  const hasta = parseParamFecha(body.hasta ?? "");
  if (!desde || !hasta) {
    return NextResponse.json({ error: "desde y hasta son obligatorios" }, { status: 400 });
  }
  if (desde.getTime() > hasta.getTime()) {
    return NextResponse.json({ error: "desde no puede ser posterior a hasta" }, { status: 400 });
  }

  await ensureMayorTables();

  try {
    const reglas = await prisma.mayorRegla.findMany({
      select: { palabra: true, cuentaId: true },
    });

    const extracto = await prisma.movimientoExtracto.findMany({
      where: {
        fecha: { gte: desde, lte: hasta },
        importePesos: { lt: 0 },
      },
      select: { id: true, fecha: true, concepto: true, importePesos: true },
      orderBy: [{ fecha: "asc" }, { id: "asc" }],
    });

    let creados = 0;
    let yaExistian = 0;
    let sinRegla = 0;
    let errores = 0;

    for (const m of extracto) {
      const dup = await findMayorMovimientoByOrigen("EXTRACTO", m.id);
      if (dup) {
        yaExistian += 1;
        continue;
      }

      const hit = matchCuentaPorReglas(m.concepto ?? "", reglas);
      if (!hit) {
        sinRegla += 1;
        continue;
      }

      try {
        await insertMayorMovimiento({
          cuentaId: hit.cuentaId,
          fecha: m.fecha,
          concepto: m.concepto,
          importe: Number(m.importePesos),
          origen: "EXTRACTO",
          origenId: m.id,
        });
        creados += 1;
      } catch {
        // conflicto unique / validación / etc.
        errores += 1;
      }
    }

    return NextResponse.json({
      ok: true,
      creados,
      yaExistian,
      sinRegla,
      errores,
      totalExtracto: extracto.length,
    });
  } catch (err) {
    console.error("mayor-movimientos/sync-extracto POST:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error al sincronizar desde extracto" },
      { status: 500 }
    );
  }
}

