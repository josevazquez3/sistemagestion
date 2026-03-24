import { COMPROMISOS_PREDEFINIDOS } from "@/lib/tesoreria/informeCompromisosPredeterminados";
import type { InformeDatosComputados } from "@/lib/tesoreria/computeInformeDatos";

export type InformeExcelProps = {
  informe: {
    fechaDesde: Date;
    fechaHasta: Date;
  };
  ingresosDistrito: {
    distritoNumero: number;
    periodos: string;
    ctaColegImporte: number;
    nMatriculadosImporte: number;
  }[];
  totalIngresosA: number;
  cobroCertificaciones: { importe: number };
  totalIngresosB: number;
  totalGeneralIngresos: number;
  egresos: {
    numero?: string;
    concepto: string;
    importe: number;
  }[];
  totalEgresos: number;
  ultimosAportes: {
    distritoNumero: number;
    fechaMostrar: Date | null;
  }[];
  conciliacion: {
    saldoBancoRio: number;
    saldoFondoFijo: number;
    chequesADepositar: number;
    total: number;
  };
  compromisos: {
    numero?: string;
    concepto: string;
    importe: number;
  }[];
  totalCompromisos: number;
  saldoFinal: number;
  textBoxes: {
    numero: number;
    contenido: string;
  }[];
};

const COLS = 6;

function formatoPeriodoLargo(desde: Date, hasta: Date): string {
  const dDia = desde.toLocaleDateString("es-AR", { day: "2-digit", timeZone: "UTC" });
  const hDia = hasta.toLocaleDateString("es-AR", { day: "2-digit", timeZone: "UTC" });
  const dMes = desde.toLocaleDateString("es-AR", { month: "long", timeZone: "UTC" });
  const hMes = hasta.toLocaleDateString("es-AR", { month: "long", timeZone: "UTC" });
  const hAnio = hasta.toLocaleDateString("es-AR", { year: "numeric", timeZone: "UTC" });
  return `${dDia} de ${dMes} al ${hDia} de ${hMes} ${hAnio}`;
}

function formatFechaDdMmYyyy(d: Date | null): string {
  if (!d) return "-";
  return d.toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  });
}

function romano(n: number): string {
  return (
    {
      1: "I",
      2: "II",
      3: "III",
      4: "IV",
      5: "V",
      6: "VI",
      7: "VII",
      8: "VIII",
      9: "IX",
      10: "X",
    }[n] ?? String(n)
  );
}

function addRow(aoa: unknown[][], ...cells: (string | number)[]) {
  const row = Array(COLS).fill("");
  for (let i = 0; i < Math.min(COLS, cells.length); i++) row[i] = cells[i] ?? "";
  aoa.push(row);
}

function splitIndicador(texto: string): { prefijo: string; cuerpo: string } {
  const t = (texto ?? "").trim();
  const m = /^(\d+\)\))\s*(.*)$/.exec(t);
  if (!m) return { prefijo: "", cuerpo: t };
  return { prefijo: m[1] ?? "", cuerpo: m[2] ?? "" };
}

function totalEgresosAbs(egresos: InformeExcelProps["egresos"]): number {
  return egresos.reduce((a, e) => a + Math.abs(e.importe), 0);
}

/**
 * Matriz de celdas compatible con `sheet_to_json` / historial JSONB (valores cerrados en totales).
 */
export function buildInformeSheetAoa(props: InformeExcelProps): unknown[][] {
  const aoa: unknown[][] = [];
  const totalCValor = totalEgresosAbs(props.egresos);
  const concTotalValor = props.conciliacion.total;
  const compTotalValor = props.totalCompromisos;
  const saldoValor = props.saldoFinal;

  addRow(
    aoa,
    `REUNION CONSEJO SUPERIOR  ${props.informe.fechaHasta.toLocaleDateString("es-AR", {
      day: "2-digit",
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    })}`,
    "",
    "",
    "",
    "",
    ""
  );

  addRow(aoa, "INFORME DE TESORERIA", "", "", "", "", "");

  addRow(aoa, "", "", "", "", "", "");

  addRow(aoa, `Periodo: del ${formatoPeriodoLargo(props.informe.fechaDesde, props.informe.fechaHasta)}`, "", "", "", "", "");

  addRow(aoa, "A) INGRESOS.", "", "", "", "", "");

  addRow(aoa, "", "DIST.", "CONCEPTO", "", "", "IMPORTE");

  for (const d of props.ingresosDistrito) {
    addRow(aoa, "", romano(d.distritoNumero), `Cta. Coleg.${d.periodos ? ` ${d.periodos}` : ""}`, "", "", d.ctaColegImporte);
    addRow(aoa, "", "", "Nuevos matriculados", "", "", d.nMatriculadosImporte);
  }

  addRow(aoa, "", "TOTAL", "", "", "", props.totalIngresosA);
  addRow(aoa, "", "", "", "", "", "");

  addRow(aoa, "B) INGRESOS.", "", "", "", "", "");

  addRow(aoa, "", "CONCEPTO", "", "", "", "IMPORTE");

  addRow(aoa, "", "COBRO CERTIFICACIONES", "", "", "", props.cobroCertificaciones.importe);

  addRow(aoa, "", "TOTAL", "", "", "", props.totalIngresosB);

  addRow(aoa, "", "TOTAL GENERAL INGRESO........................................................", "", "", "", props.totalGeneralIngresos);
  addRow(aoa, "", "", "", "", "", "");

  addRow(aoa, "C) EGRESOS.", "", "", "", "", "");

  addRow(aoa, "", "CONCEPTO", "", "", "", "IMPORTE");

  for (const e of props.egresos) {
    const { prefijo, cuerpo } = splitIndicador(e.concepto);
    addRow(aoa, prefijo, cuerpo, "", "", "", Math.abs(e.importe));
  }

  addRow(aoa, "", "TOTAL............................................................", "", "", "", totalCValor);
  addRow(aoa, "", "", "", "", "", "");

  addRow(aoa, "ULTIMOS APORTES DISTRITALES EN CONCEPTO DE", "", "", "", "", "");

  addRow(aoa, "NUEVOS MATRICULADOS Y GS. ADMINISTRATIVOS", "", "", "", "", "");

  addRow(aoa, "", "", "", "", "", "");

  for (let i = 0; i < 5; i++) {
    const leftDist = i + 1;
    const rightDist = i + 6;
    const left = props.ultimosAportes.find((x) => x.distritoNumero === leftDist);
    const right = props.ultimosAportes.find((x) => x.distritoNumero === rightDist);
    addRow(
      aoa,
      "",
      `Distrito ${romano(leftDist)}`,
      formatFechaDdMmYyyy(left?.fechaMostrar ?? null),
      `Distrito ${romano(rightDist)}`,
      formatFechaDdMmYyyy(right?.fechaMostrar ?? null),
      ""
    );
  }
  addRow(aoa, "", "", "", "", "", "");

  addRow(aoa, "CONCILIACION FINANCIERA PROYECTADA", "", "", "", "", "");

  addRow(aoa, "", "", "", "", "", "");

  addRow(aoa, `Periodo: del ${formatoPeriodoLargo(props.informe.fechaDesde, props.informe.fechaHasta)}`, "", "", "", "", "");

  addRow(aoa, "", "", "", "", "", "");

  addRow(aoa, "I)", "SALDO Banco Rio Cta. Cte........................................................", "", "", "", props.conciliacion.saldoBancoRio);

  addRow(aoa, "II)", "SALDO Fondo Fijo...............................................................", "", "", "", props.conciliacion.saldoFondoFijo);

  addRow(aoa, "III)", "Cheques a depositar............................................................", "", "", "", props.conciliacion.chequesADepositar);

  addRow(aoa, "", "TOTAL:", "..............", "................................", "", concTotalValor);

  addRow(aoa, "", "", "", "", "", "");

  addRow(aoa, "IV)", "COMPROMISOS A PAGAR: ..........................................................", "", "", "", compTotalValor);

  for (const c of props.compromisos) {
    const { prefijo, cuerpo } = splitIndicador(c.concepto);
    addRow(aoa, prefijo || (c.numero ?? ""), cuerpo, "", "", "", c.importe);
  }

  addRow(aoa, "", "", "", "", "", "");

  addRow(aoa, "", "SALDO......................................................................", "", "", "", saldoValor);

  addRow(aoa, "", "", "", "", "", "");

  for (const t of props.textBoxes) {
    addRow(aoa, "", `${t.numero})) ${t.contenido}`, "", "", "", "");
  }

  return aoa;
}

type InformeDbSnapshot = {
  fechaDesde: Date;
  fechaHasta: Date;
  egresos: Array<{ numero: string | null; concepto: string; importe: unknown; orden: number; id: number }>;
  compromisos: Array<{ numero: string | null; concepto: string; importe: unknown; orden: number; id: number }>;
  textBoxes: Array<{ numero: number; contenido: string; orden: number; id: number }>;
};

function toNum(v: unknown): number {
  if (typeof v === "number") return v;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export function buildInformeExcelPropsFromSnapshot(
  informe: InformeDbSnapshot,
  datos: InformeDatosComputados
): InformeExcelProps {
  const egresosDb =
    informe.egresos.length > 0
      ? [...informe.egresos]
          .sort((a, b) => a.orden - b.orden || a.id - b.id)
          .map((x) => ({
            numero: x.numero ?? undefined,
            concepto: x.concepto,
            importe: toNum(x.importe),
          }))
      : datos.egresosCuentas.map((x) => ({
          concepto: x.nombreCuenta,
          importe: x.totalMovimientos,
        }));

  const totalEgresos = egresosDb.reduce((a, e) => a + e.importe, 0);

  const compromisosDb =
    informe.compromisos.length > 0
      ? [...informe.compromisos]
          .sort((a, b) => a.orden - b.orden || a.id - b.id)
          .map((x) => ({
            numero: x.numero ?? undefined,
            concepto: x.concepto,
            importe: toNum(x.importe),
          }))
      : COMPROMISOS_PREDEFINIDOS.map((concepto) => ({
          concepto,
          importe: 0,
        }));

  const totalCompromisos = compromisosDb.reduce((a, c) => a + c.importe, 0);
  const conc = datos.conciliacion;
  const saldoFinal = conc.total - totalCompromisos;

  const ultimosAportes = [];
  for (let n = 1; n <= 10; n++) {
    const hit = datos.ultimosAportes.find((x) => x.distritoNumero === n);
    const iso = hit?.fechaOverride ?? hit?.ultimaFecha ?? null;
    ultimosAportes.push({
      distritoNumero: n,
      fechaMostrar: iso ? new Date(iso) : null,
    });
  }

  const textBoxes = [...informe.textBoxes]
    .sort((a, b) => a.orden - b.orden || a.id - b.id)
    .map((t) => ({ numero: t.numero, contenido: t.contenido }));

  return {
    informe: {
      fechaDesde: informe.fechaDesde,
      fechaHasta: informe.fechaHasta,
    },
    ingresosDistrito: datos.ingresosDistrito,
    totalIngresosA: datos.totalIngresosA,
    cobroCertificaciones: { importe: datos.cobroCertificaciones.importe },
    totalIngresosB: datos.totalIngresosB,
    totalGeneralIngresos: datos.totalGeneralIngresos,
    egresos: egresosDb,
    totalEgresos,
    ultimosAportes,
    conciliacion: datos.conciliacion,
    compromisos: compromisosDb,
    totalCompromisos,
    saldoFinal,
    textBoxes,
  };
}
