import * as XLSX from "xlsx-js-style";
import type { MayorMovimiento } from "@/types/tesoreria";
import { formatearFechaUTC } from "@/lib/utils/fecha";

const NUM_FMT = "#,##0.00";

const STY_HEADER = {
  font: { bold: true, color: { rgb: "FFFFFFFF" } },
  fill: { patternType: "solid" as const, fgColor: { rgb: "FF1F4E78" } },
  alignment: { horizontal: "center" as const, vertical: "center" as const },
};

const STY_GROUP_TITLE = {
  font: { bold: true },
  fill: { patternType: "solid" as const, fgColor: { rgb: "FFD9D9D9" } },
  alignment: { horizontal: "left" as const, vertical: "center" as const },
};

const STY_SUBTOTAL = {
  font: { bold: true },
  fill: { patternType: "solid" as const, fgColor: { rgb: "FFFFFF99" } },
};

const STY_TOTAL_GENERAL = {
  font: { bold: true },
  fill: { patternType: "solid" as const, fgColor: { rgb: "FFC8E6C9" } },
};

const STY_BOLD = { font: { bold: true } };

function etiquetaOrigen(o: string): string {
  if (o === "EXTRACTO") return "Extracto Banco";
  if (o === "FONDO_FIJO") return "Fondo Fijo";
  if (o === "MANUAL") return "Manual";
  return o;
}

export function safeNombreArchivo(s: string): string {
  return (
    s
      .normalize("NFD")
      .replace(/\p{M}/gu, "")
      .replace(/[^\w\s-]/g, "")
      .replace(/\s+/g, "_")
      .replace(/_+/g, "_")
      .slice(0, 60) || "Mayores"
  );
}

/** Etiqueta para nombre de archivo según cuentas presentes en los movimientos. */
export function nombreCuentaParaArchivo(movs: MayorMovimiento[]): string {
  const names = [...new Set(movs.map((m) => m.cuentaNombre).filter(Boolean))];
  if (names.length === 1) return safeNombreArchivo(names[0]!);
  if (names.length === 0) return "Sin_movimientos";
  return `Varias_cuentas_${names.length}`;
}

export function periodoParaArchivo(desde: string, hasta: string): string {
  return `${desde.replace(/\//g, "-")}_${hasta.replace(/\//g, "-")}`;
}

function fmtFechaMov(m: MayorMovimiento): string {
  if (!m.fecha) return "";
  try {
    return formatearFechaUTC(new Date(m.fecha));
  } catch {
    return "";
  }
}

function importePos(m: MayorMovimiento): number {
  return Math.abs(Number(m.importe) || 0);
}

function cell(
  v: string | number,
  opts?: { t?: "s" | "n"; s?: XLSX.CellStyle; z?: string }
): XLSX.CellObject {
  const t = opts?.t ?? (typeof v === "number" ? "n" : "s");
  const o: XLSX.CellObject = { v, t };
  if (opts?.s) o.s = opts.s;
  if (opts?.z && t === "n") o.z = opts.z;
  return o;
}

function sortByFechaAsc(a: MayorMovimiento, b: MayorMovimiento): number {
  const ta = a.fecha ? new Date(a.fecha).getTime() : 0;
  const tb = b.fecha ? new Date(b.fecha).getTime() : 0;
  return ta - tb || a.id - b.id;
}

/** Ancho de columna según texto máximo (aprox. caracteres). */
function aplicarAnchos(ws: XLSX.WorkSheet, numCols: number) {
  const ref = ws["!ref"];
  if (!ref) return;
  const range = XLSX.utils.decode_range(ref);
  const wch: number[] = Array(numCols).fill(10);
  for (let R = range.s.r; R <= range.e.r; R++) {
    for (let C = 0; C < numCols; C++) {
      const addr = XLSX.utils.encode_cell({ r: R, c: C });
      const cel = ws[addr];
      if (!cel || cel.v === null || cel.v === undefined) continue;
      const len = String(cel.v).length;
      wch[C] = Math.min(50, Math.max(wch[C]!, len + 2));
    }
  }
  ws["!cols"] = wch.map((w) => ({ wch: w }));
}

const COLS = 5;
const HEADERS = ["Fecha", "Concepto", "Importe", "Cuenta", "Origen"];

function filaEncabezadoTabla(): XLSX.CellObject[] {
  return HEADERS.map((h) => cell(h, { t: "s", s: STY_HEADER }));
}

function filaMovimiento(m: MayorMovimiento): XLSX.CellObject[] {
  return [
    cell(fmtFechaMov(m), { t: "s" }),
    cell(m.concepto ?? "", { t: "s" }),
    cell(importePos(m), { t: "n", z: NUM_FMT }),
    cell(m.cuentaNombre ?? "", { t: "s" }),
    cell(etiquetaOrigen(m.origen), { t: "s" }),
  ];
}

/** Workbook plano del período (título, cantidad, tabla, total). */
function buildWorkbookMovimientosPlano(
  sorted: MayorMovimiento[],
  desde: string,
  hasta: string
): XLSX.WorkBook {
  const aoa: XLSX.CellObject[][] = [];

  aoa.push([
    cell(`Movimientos del período: ${desde} — ${hasta}`, {
      t: "s",
      s: STY_BOLD,
    }),
    cell("", { t: "s" }),
    cell("", { t: "s" }),
    cell("", { t: "s" }),
    cell("", { t: "s" }),
  ]);
  aoa.push([
    cell(`Cantidad de movimientos: ${sorted.length}`, { t: "s" }),
    cell("", { t: "s" }),
    cell("", { t: "s" }),
    cell("", { t: "s" }),
    cell("", { t: "s" }),
  ]);
  aoa.push([cell("", { t: "s" }), cell("", { t: "s" }), cell("", { t: "s" }), cell("", { t: "s" }), cell("", { t: "s" })]);
  aoa.push(filaEncabezadoTabla());

  let suma = 0;
  for (const m of sorted) {
    aoa.push(filaMovimiento(m));
    suma += importePos(m);
  }

  const totalRow: XLSX.CellObject[] = [
    cell("TOTAL", { t: "s", s: STY_BOLD }),
    cell("", { t: "s", s: STY_BOLD }),
    cell(suma, { t: "n", s: STY_BOLD, z: NUM_FMT }),
    cell("", { t: "s", s: STY_BOLD }),
    cell("", { t: "s", s: STY_BOLD }),
  ];
  aoa.push(totalRow);

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!merges"] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: COLS - 1 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: COLS - 1 } },
  ];
  aplicarAnchos(ws, COLS);

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Movimientos");
  return wb;
}

/**
 * Export simple: título, cantidad, tabla con total al final.
 */
export function exportarMovimientosPeriodoExcel(
  movimientos: MayorMovimiento[],
  desde: string,
  hasta: string
): void {
  const sorted = [...movimientos].sort(sortByFechaAsc);
  const nombreCta = nombreCuentaParaArchivo(sorted);
  const periodo = periodoParaArchivo(desde, hasta);
  const wb = buildWorkbookMovimientosPlano(sorted, desde, hasta);
  const fname = `movimientos_${nombreCta}_${periodo}.xlsx`;
  XLSX.writeFile(wb, fname);
}

export type AgrupacionMinuta = "cuenta" | "origen" | "concepto" | "ninguno";

function etiquetaAgrupacion(t: AgrupacionMinuta): string {
  switch (t) {
    case "cuenta":
      return "Cuenta";
    case "origen":
      return "Origen";
    case "concepto":
      return "Concepto";
    case "ninguno":
      return "Sin_agrupacion";
    default:
      return "Sin_agrupacion";
  }
}

function claveGrupo(m: MayorMovimiento, t: AgrupacionMinuta): string {
  if (t === "cuenta") return m.cuentaNombre || "(sin cuenta)";
  if (t === "origen") return etiquetaOrigen(m.origen);
  if (t === "concepto") return m.concepto || "(sin concepto)";
  return "";
}

function buildWorkbookMinutaAgrupada(
  sorted: MayorMovimiento[],
  desde: string,
  hasta: string,
  agrupacion: AgrupacionMinuta
): XLSX.WorkBook {
  const tagGrupo = etiquetaAgrupacion(agrupacion);

  const grupos = new Map<string, MayorMovimiento[]>();
  for (const m of sorted) {
    const k = claveGrupo(m, agrupacion);
    if (!grupos.has(k)) grupos.set(k, []);
    grupos.get(k)!.push(m);
  }
  const ordenGrupos = [...grupos.keys()].sort((a, b) =>
    a.localeCompare(b, "es", { sensitivity: "base" })
  );

  const aoa: XLSX.CellObject[][] = [];
  aoa.push([
    cell(`Movimientos del período: ${desde} — ${hasta} (Minuta por ${tagGrupo.replace(/_/g, " ")})`, {
      t: "s",
      s: STY_BOLD,
    }),
    cell("", { t: "s" }),
    cell("", { t: "s" }),
    cell("", { t: "s" }),
    cell("", { t: "s" }),
  ]);
  aoa.push([
    cell(`Cantidad de movimientos: ${sorted.length}`, { t: "s" }),
    cell("", { t: "s" }),
    cell("", { t: "s" }),
    cell("", { t: "s" }),
    cell("", { t: "s" }),
  ]);
  aoa.push([cell("", { t: "s" }), cell("", { t: "s" }), cell("", { t: "s" }), cell("", { t: "s" }), cell("", { t: "s" })]);

  let totalGeneral = 0;
  const merges: XLSX.Range[] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: COLS - 1 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: COLS - 1 } },
  ];
  let currentRow = aoa.length;

  for (const nombreGrupo of ordenGrupos) {
    const items = (grupos.get(nombreGrupo) ?? []).slice().sort(sortByFechaAsc);
    if (items.length === 0) continue;

    merges.push({
      s: { r: currentRow, c: 0 },
      e: { r: currentRow, c: COLS - 1 },
    });
    aoa.push([
      cell(nombreGrupo, { t: "s", s: STY_GROUP_TITLE }),
      cell("", { t: "s", s: STY_GROUP_TITLE }),
      cell("", { t: "s", s: STY_GROUP_TITLE }),
      cell("", { t: "s", s: STY_GROUP_TITLE }),
      cell("", { t: "s", s: STY_GROUP_TITLE }),
    ]);
    currentRow++;
    aoa.push(filaEncabezadoTabla());
    currentRow++;

    let sub = 0;
    for (const m of items) {
      aoa.push(filaMovimiento(m));
      sub += importePos(m);
      currentRow++;
    }

    aoa.push([
      cell(`Subtotal ${nombreGrupo}`, { t: "s", s: STY_SUBTOTAL }),
      cell("", { t: "s", s: STY_SUBTOTAL }),
      cell(sub, { t: "n", s: STY_SUBTOTAL, z: NUM_FMT }),
      cell("", { t: "s", s: STY_SUBTOTAL }),
      cell("", { t: "s", s: STY_SUBTOTAL }),
    ]);
    currentRow++;
    totalGeneral += sub;

    aoa.push([cell("", { t: "s" }), cell("", { t: "s" }), cell("", { t: "s" }), cell("", { t: "s" }), cell("", { t: "s" })]);
    currentRow++;
  }

  aoa.push([
    cell("TOTAL GENERAL", { t: "s", s: STY_TOTAL_GENERAL }),
    cell("", { t: "s", s: STY_TOTAL_GENERAL }),
    cell(totalGeneral, { t: "n", s: STY_TOTAL_GENERAL, z: NUM_FMT }),
    cell("", { t: "s", s: STY_TOTAL_GENERAL }),
    cell("", { t: "s", s: STY_TOTAL_GENERAL }),
  ]);

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!merges"] = merges;
  aplicarAnchos(ws, COLS);

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Minuta");
  return wb;
}

/**
 * Genera el mismo Excel que la exportación de minuta, sin descargar (p. ej. guardar en historial).
 */
export function generarMinutaMayorMovimientosWorkbook(
  movimientos: MayorMovimiento[],
  desde: string,
  hasta: string,
  agrupacion: AgrupacionMinuta
): { wb: XLSX.WorkBook; fileName: string } {
  const sorted = [...movimientos].sort(sortByFechaAsc);
  const nombreCta = nombreCuentaParaArchivo(sorted);
  const periodo = periodoParaArchivo(desde, hasta);

  if (agrupacion === "ninguno") {
    const fname = `minuta_${nombreCta}_${periodo}.xlsx`;
    return { wb: buildWorkbookMovimientosPlano(sorted, desde, hasta), fileName: fname };
  }

  const tagGrupo = etiquetaAgrupacion(agrupacion);
  const fname = `minuta_${tagGrupo}_${nombreCta}_${periodo}.xlsx`;
  return {
    wb: buildWorkbookMinutaAgrupada(sorted, desde, hasta, agrupacion),
    fileName: fname,
  };
}

/** Serializa el workbook a bytes .xlsx (navegador). */
export function workbookMayorToXlsxUint8Array(wb: XLSX.WorkBook): Uint8Array {
  return XLSX.write(wb, { bookType: "xlsx", type: "array" }) as Uint8Array;
}

/**
 * Minuta con agrupación o plano (ninguno = igual estructura que export simple, otro nombre).
 */
export function exportarMinutaMayorMovimientos(
  movimientos: MayorMovimiento[],
  desde: string,
  hasta: string,
  agrupacion: AgrupacionMinuta
): void {
  const { wb, fileName } = generarMinutaMayorMovimientosWorkbook(movimientos, desde, hasta, agrupacion);
  XLSX.writeFile(wb, fileName);
}
