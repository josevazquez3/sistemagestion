/** Normaliza para comparar conceptos y palabras clave (minúsculas, sin marcas diacríticas). */
export function normalizarTextoMayor(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Primeras `max` palabras “significativas”: longitud ≥ 4 y no solo dígitos.
 * Orden de aparición en el concepto.
 */
export function extraerPalabrasSignificativasConcepto(
  concepto: string,
  max = 3
): string[] {
  const out: string[] = [];
  const tokens = concepto.match(/[^\s,.;:\-_/\\|<>()[\]{}]+/g) ?? [];
  for (const t of tokens) {
    if (out.length >= max) break;
    if (t.length < 4) continue;
    if (/^\d+$/.test(t)) continue;
    out.push(t.toLowerCase());
  }
  return out;
}

export type ReglaMatchInput = { palabra: string; cuentaId: number };

/** Si varias reglas coinciden, gana la palabra más larga (más específica). */
export function matchCuentaPorReglas(
  concepto: string,
  reglas: ReglaMatchInput[]
): { cuentaId: number; palabra: string } | null {
  if (!reglas.length) return null;
  const normConcepto = normalizarTextoMayor(concepto);
  if (!normConcepto) return null;
  const ordenadas = [...reglas].sort(
    (a, b) => b.palabra.length - a.palabra.length
  );
  for (const r of ordenadas) {
    const p = normalizarTextoMayor(r.palabra);
    if (p.length > 0 && normConcepto.includes(p)) {
      return { cuentaId: r.cuentaId, palabra: r.palabra };
    }
  }
  return null;
}
