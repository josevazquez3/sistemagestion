/**
 * Clasificación de cuentas bancarias para la vista previa mensual de conciliación.
 * Usa nombre + código (insensible a mayúsculas y sin acentos).
 */

export function normalizeCuentaText(s: string): string {
  return String(s ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function cuentaEsGastosBancarios(nombre: string, codigo: string): boolean {
  const t = `${normalizeCuentaText(nombre)} ${normalizeCuentaText(codigo)}`;
  if (t.includes("gastos bancarios")) return true;
  if (t.includes("gasto") && t.includes("banc")) return true;
  if (t.includes("comision") && t.includes("banc")) return true;
  return false;
}

export function cuentaEsCobroCertificacion(nombre: string, codigo: string): boolean {
  const t = `${normalizeCuentaText(nombre)} ${normalizeCuentaText(codigo)}`;
  return t.includes("certific") || t.includes("cobro cert");
}

/** Transferencias / ingresos distrito en extracto */
export function cuentaEsTransferenciaDistritos(nombre: string, codigo: string): boolean {
  const t = `${normalizeCuentaText(nombre)} ${normalizeCuentaText(codigo)}`;
  if (!t.includes("distrito")) return false;
  return t.includes("transfer") || t.includes("ingreso") || t.includes("distritos");
}

export function conceptoEsDevolucionCertificacion(concepto: string): boolean {
  const t = normalizeCuentaText(concepto);
  return t.includes("devolucion") || t.includes("devolución");
}

export function tokensCuentaBancaria(codigo: string, codOperativo: string | null): Set<string> {
  const s = new Set<string>();
  const c = String(codigo ?? "").trim().toUpperCase();
  if (c) s.add(c);
  String(codOperativo ?? "")
    .replace(/[/|\r\n]+/g, " ")
    .split(/\s+/)
    .map((x) => x.trim().toUpperCase())
    .filter(Boolean)
    .forEach((t) => s.add(t));
  return s;
}

export function cuentaCoincideConCodigos(
  codigo: string,
  codOperativo: string | null,
  codigosConfig: string[]
): boolean {
  if (!codigosConfig.length) return false;
  const tokens = tokensCuentaBancaria(codigo, codOperativo);
  return codigosConfig.some((raw) => {
    const t = String(raw ?? "").trim().toUpperCase();
    return t && tokens.has(t);
  });
}

export const round2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;
