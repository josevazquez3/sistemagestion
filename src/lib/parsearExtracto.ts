/**
 * Utilidades para parsear archivos de extracto bancario (CSV/TSV)
 * y formatear importes en formato argentino.
 */

export function formatearImporteAR(valor: number): string {
  const abs = Math.abs(valor);
  const str = abs.toLocaleString("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return valor < 0 ? `(${str})` : str;
}

/** "(6.282,92)" → -6282.92, "15.000,00" → 15000.00 */
export function parsearImporteAR(str: string): number {
  const negativo = str.trim().startsWith("(") && str.trim().endsWith(")");
  const limpio = str
    .replace(/[()]/g, "")
    .replace(/\./g, "")
    .replace(",", ".");
  const valor = parseFloat(limpio) || 0;
  return negativo ? -valor : valor;
}

/** DD/MM/YYYY → ISO mediodía UTC (mismo criterio que el resto del sistema) */
export function parsearFechaAR(str: string): string {
  const [d, m, y] = str.trim().split("/");
  if (!d || !m || !y) return "";
  const day = parseInt(d, 10);
  const month = parseInt(m, 10);
  const year = parseInt(y, 10);
  if (!day || !month || !year) return "";
  const t = Date.UTC(year, month - 1, day, 12, 0, 0, 0);
  return new Date(t).toISOString();
}

export type MovimientoRaw = {
  fecha: string; // ISO con offset de Argentina
  sucOrigen?: string;
  descSucursal?: string;
  codOperativo?: string;
  referencia?: string;
  concepto: string;
  importePesos: number;
  saldoPesos: number;
};

/**
 * Parsea el contenido de texto del extracto (CSV o TSV).
 * Busca la línea de encabezados que contiene "Fecha" y "Concepto",
 * luego parsea cada fila de datos.
 */
export function parsearArchivoExtracto(contenido: string): MovimientoRaw[] {
  const delimitador = contenido.includes("\t") ? "\t" : ";";
  const lineas = contenido.split(/\r?\n/);

  const idxHeader = lineas.findIndex(
    (l) =>
      l.toLowerCase().includes("fecha") && l.toLowerCase().includes("concepto")
  );
  if (idxHeader === -1) throw new Error("Formato de archivo no reconocido");

  const movimientos: MovimientoRaw[] = [];
  for (let i = idxHeader + 1; i < lineas.length; i++) {
    const linea = lineas[i];
    if (!linea.trim()) continue;
    const cols = linea.split(delimitador);
    if (cols.length < 6) continue;
    const fechaStr = cols[0]?.trim() ?? "";
    if (!fechaStr.match(/\d{2}\/\d{2}\/\d{4}/)) continue;

    const importeStr = cols[6]?.trim() ?? "0";
    const saldoStr = cols[7]?.trim() ?? "0";
    const tipoStr = (cols[8] ?? "").trim().toUpperCase();

    const fechaIso = parsearFechaAR(fechaStr);
    if (!fechaIso) continue;

    let importePesos = parsearImporteAR(importeStr);
    const esDebito =
      importeStr.trim().startsWith("(") && importeStr.trim().endsWith(")") ||
      /^D(EBITO)?$/.test(tipoStr) ||
      /^DEBE$/.test(tipoStr);
    if (esDebito && importePesos > 0) importePesos = -importePesos;

    const codOp = cols[3]?.trim() || undefined;
    const ref = cols[4]?.trim() || undefined;
    const conceptoCol = cols[5]?.trim() ?? "";
    let concepto =
      conceptoCol ||
      ref ||
      cols[2]?.trim() ||
      "";
    if (codOp && concepto.trim() === codOp.trim()) concepto = "";
    movimientos.push({
      fecha: fechaIso,
      sucOrigen: cols[1]?.trim() || undefined,
      descSucursal: cols[2]?.trim() || undefined,
      codOperativo: codOp,
      referencia: ref,
      concepto,
      importePesos,
      saldoPesos: parsearImporteAR(saldoStr),
    });
  }
  return movimientos;
}
