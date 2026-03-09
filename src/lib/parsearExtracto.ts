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

/** DD/MM/YYYY → ISO string (YYYY-MM-DD) */
export function parsearFechaAR(str: string): string {
  const [d, m, y] = str.trim().split("/");
  if (!d || !m || !y) return "";
  return `${y}-${m}-${d}`;
}

export type MovimientoRaw = {
  fecha: string; // ISO YYYY-MM-DD
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

    const fechaIso = parsearFechaAR(fechaStr);
    if (!fechaIso) continue;

    movimientos.push({
      fecha: fechaIso,
      sucOrigen: cols[1]?.trim() || undefined,
      descSucursal: cols[2]?.trim() || undefined,
      codOperativo: cols[3]?.trim() || undefined,
      referencia: cols[4]?.trim() || undefined,
      concepto: cols[5]?.trim() ?? "",
      importePesos: parsearImporteAR(importeStr),
      saldoPesos: parsearImporteAR(saldoStr),
    });
  }
  return movimientos;
}
