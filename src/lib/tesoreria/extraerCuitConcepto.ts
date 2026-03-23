/** Patrón CUIT con guiones: XX-XXXXXXXX-X */
const PATRON_CUIT = /\d{2}-\d{8}-\d/;

export function extraerCuitDelConcepto(concepto: string): string | null {
  if (!concepto) return null;
  const m = concepto.match(PATRON_CUIT);
  return m ? m[0] : null;
}

/** Solo dígitos, para comparar con la lista guardada aunque el formato varíe */
export function normalizarCuitParaMatch(cuit: string): string {
  return cuit.replace(/\D/g, "");
}
