import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { EstadoLicencia } from "@prisma/client";
import {
  primerDiaMesNoonUTC,
  ultimoDiaMesNoonUTC,
  formatearFechaUTC,
} from "@/lib/utils/fecha";

export const dynamic = "force-dynamic";

const ROLES = ["ADMIN", "RRHH"] as const;

function canAccess(roles: string[]) {
  return ROLES.some((r) => roles.includes(r));
}

function rangosSeSolapan(aDesde: Date, aHasta: Date, bDesde: Date, bHasta: Date): boolean {
  return aDesde <= bHasta && aHasta >= bDesde;
}

function formatDDMMYYYY(d: Date): string {
  return formatearFechaUTC(d);
}

export type FilaPlanillaAPI = {
  legajoId: string;
  numeroLegajo: number;
  apellidoNombre: string;
  feriado: number | null;
  diaUtedyc: number | null;
  carpeta: number | null;
  vacaciones: number | null;
  adelanto: number | null;
  otros: number | null;
  observacion: string | null;
  novedadIds: string[];
};

/** GET - Datos para la planilla filtrados por mes (periodo=YYYY-MM) */
export async function GET(request: NextRequest) {
  const session = await auth();
  const roles = (session?.user as { roles?: string[] })?.roles ?? [];
  if (!canAccess(roles)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const periodo = searchParams.get("periodo") ?? "";

  let inicioMes: Date;
  let finMes: Date;

  if (periodo && /^\d{4}-\d{2}$/.test(periodo)) {
    const [año, mes] = periodo.split("-").map(Number);
    inicioMes = primerDiaMesNoonUTC(año, mes);
    finMes = ultimoDiaMesNoonUTC(año, mes);
  } else {
    const hoy = new Date();
    const y = hoy.getUTCFullYear();
    const m = hoy.getUTCMonth() + 1;
    inicioMes = primerDiaMesNoonUTC(y, m);
    finMes = ultimoDiaMesNoonUTC(y, m);
  }

  const solicitudes = await prisma.solicitudVacaciones.findMany({
    where: {
      estado: "APROBADA",
      OR: [
        { fechaDesde: { gte: inicioMes, lte: finMes } },
        { fechaHasta: { gte: inicioMes, lte: finMes } },
        { fechaDesde: { lte: inicioMes }, fechaHasta: { gte: finMes } },
      ],
    },
    include: { legajo: { select: { id: true, numeroLegajo: true, nombres: true, apellidos: true } } },
  });

  const licencias = await prisma.licencia.findMany({
    where: {
      AND: [
        { fechaInicio: { lte: finMes } },
        {
          OR: [
            { estado: EstadoLicencia.ACTIVA },
            { fechaFin: { gte: inicioMes } },
          ],
        },
        {
          OR: [{ fechaFin: { gte: inicioMes } }, { fechaFin: null }],
        },
      ],
    },
    include: { legajo: { select: { id: true, numeroLegajo: true, nombres: true, apellidos: true } } },
  });

  const novedades = await prisma.novedadLiquidacion.findMany({
    where: {
      liquidado: false,
      OR: [
        { fechaDesde: { gte: inicioMes, lte: finMes } },
        { fechaHasta: { gte: inicioMes, lte: finMes } },
        { fechaDesde: { lte: inicioMes }, fechaHasta: { gte: finMes } },
      ],
    },
    include: { legajo: { select: { id: true, numeroLegajo: true, nombres: true, apellidos: true } } },
  });

  const legajosConNovedadVacaciones = [
    ...new Set(novedades.filter((n) => n.tipo === "VACACIONES").map((n) => n.legajoId)),
  ];
  const solicitudesVacacionesRespaldoNovedad =
    legajosConNovedadVacaciones.length > 0
      ? await prisma.solicitudVacaciones.findMany({
          where: {
            estado: "APROBADA",
            legajoId: { in: legajosConNovedadVacaciones },
          },
          select: { legajoId: true, fechaDesde: true, fechaHasta: true },
        })
      : [];

  function tieneVacacionesAprobadasParaNovedad(legajoId: string, nDesde: Date, nHasta: Date): boolean {
    return solicitudesVacacionesRespaldoNovedad.some(
      (p) =>
        p.legajoId === legajoId &&
        rangosSeSolapan(p.fechaDesde, p.fechaHasta, nDesde, nHasta)
    );
  }

  const mapa = new Map<string, FilaPlanillaAPI>();

  for (const vac of solicitudes) {
    const desde = vac.fechaDesde < inicioMes ? inicioMes : vac.fechaDesde;
    const hasta = vac.fechaHasta > finMes ? finMes : vac.fechaHasta;
    const obs = `${formatDDMMYYYY(desde)} al ${formatDDMMYYYY(hasta)}`;
    const key = vac.legajoId;
    if (!mapa.has(key)) {
      mapa.set(key, {
        legajoId: vac.legajo.id,
        numeroLegajo: vac.legajo.numeroLegajo,
        apellidoNombre: `${(vac.legajo.apellidos || "").toUpperCase()}, ${(vac.legajo.nombres || "").toUpperCase()}`,
        feriado: null,
        diaUtedyc: null,
        carpeta: null,
        vacaciones: 2501,
        adelanto: null,
        otros: null,
        observacion: obs,
        novedadIds: [],
      });
    } else {
      const f = mapa.get(key)!;
      f.vacaciones = 2501;
      if (f.observacion && !f.observacion.includes(obs)) f.observacion += " | " + obs;
      else if (!f.observacion) f.observacion = obs;
    }
  }

  for (const lic of licencias) {
    const desde = lic.fechaInicio < inicioMes ? inicioMes : lic.fechaInicio;
    const hasta = lic.fechaFin
      ? lic.fechaFin > finMes
        ? finMes
        : lic.fechaFin
      : finMes;
    const obs = `${formatDDMMYYYY(desde)} al ${formatDDMMYYYY(hasta)}`;
    const key = lic.legajoId;
    if (!mapa.has(key)) {
      mapa.set(key, {
        legajoId: lic.legajo.id,
        numeroLegajo: lic.legajo.numeroLegajo,
        apellidoNombre: `${(lic.legajo.apellidos || "").toUpperCase()}, ${(lic.legajo.nombres || "").toUpperCase()}`,
        feriado: null,
        diaUtedyc: lic.tipoLicencia === "ESTUDIO" ? 2601 : null,
        carpeta: ["ART", "ENFERMEDAD"].includes(lic.tipoLicencia) ? 2641 : null,
        vacaciones: null,
        adelanto: null,
        otros: null,
        observacion: obs,
        novedadIds: [],
      });
    } else {
      const f = mapa.get(key)!;
      if (lic.tipoLicencia === "ESTUDIO") f.diaUtedyc = 2601;
      if (["ART", "ENFERMEDAD"].includes(lic.tipoLicencia)) f.carpeta = 2641;
      if (f.observacion && !f.observacion.includes(obs)) f.observacion += " | " + obs;
      else if (!f.observacion) f.observacion = obs;
    }
  }

  for (const n of novedades) {
    if (
      n.tipo === "VACACIONES" &&
      !tieneVacacionesAprobadasParaNovedad(n.legajoId, n.fechaDesde, n.fechaHasta)
    ) {
      continue;
    }
    const key = n.legajoId;
    const obs = n.observacion ?? "";
    if (!mapa.has(key)) {
      mapa.set(key, {
        legajoId: n.legajo.id,
        numeroLegajo: n.legajo.numeroLegajo,
        apellidoNombre: `${(n.legajo.apellidos || "").toUpperCase()}, ${(n.legajo.nombres || "").toUpperCase()}`,
        feriado: n.tipo === "FERIADO" ? (n.codigo ?? 2611) : null,
        diaUtedyc: n.tipo === "DIA_UTEDYC" ? (n.codigo ?? 2601) : null,
        carpeta: n.tipo === "CARPETA" ? (n.codigo ?? 2641) : null,
        vacaciones: n.tipo === "VACACIONES" ? (n.codigo ?? 2501) : null,
        adelanto: n.tipo === "ADELANTO" ? (n.codigo ?? 7311) : null,
        otros: n.tipo === "OTROS" ? (n.codigo ?? null) : null,
        observacion: obs || null,
        novedadIds: [n.id],
      });
    } else {
      const f = mapa.get(key)!;
      f.novedadIds.push(n.id);
      if (n.observacion) f.observacion = f.observacion ? `${f.observacion} | ${n.observacion}` : n.observacion;
      switch (n.tipo) {
        case "FERIADO":
          f.feriado = n.codigo ?? 2611;
          break;
        case "DIA_UTEDYC":
          f.diaUtedyc = n.codigo ?? 2601;
          break;
        case "CARPETA":
          f.carpeta = n.codigo ?? 2641;
          break;
        case "VACACIONES":
          f.vacaciones = n.codigo ?? 2501;
          break;
        case "ADELANTO":
          f.adelanto = n.codigo ?? 7311;
          break;
        default:
          f.otros = n.codigo ?? null;
      }
    }
  }

  const filas = Array.from(mapa.values()).sort(
    (a, b) => a.apellidoNombre.localeCompare(b.apellidoNombre)
  );

  return NextResponse.json(
    {
      data: filas,
      periodo:
        periodo ||
        `${inicioMes.getUTCFullYear()}-${String(inicioMes.getUTCMonth() + 1).padStart(2, "0")}`,
    },
    { headers: { "Cache-Control": "private, no-store, must-revalidate" } }
  );
}
