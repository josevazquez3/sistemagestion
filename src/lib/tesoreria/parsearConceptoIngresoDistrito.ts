/**
 * Parsea el campo CONCEPTO de Ingresos Distritos.
 * 1. Simple:   "CTA. COLEG. 08/2025" → ctaColeg = importe, nMatriculados = null
 * 2. Combinado: "CTA. COLEG. 08/2025 $ 402.484 Y N. MAT. $ 140.041,96"
 *    → ctaColeg = primer número después de "$"
 *    → nMatriculados = número después de "N. MAT. $"
 */
export function parsearConceptoIngresoDistrito(
  concepto: string,
  importeTotal: number
): { ctaColeg: number | null; nMatriculados: number | null } {
  const raw = (concepto ?? "").trim();
  if (!raw) {
    return { ctaColeg: importeTotal, nMatriculados: null };
  }

  const nMatMatch = raw.match(/N\.\s*MAT\.\s*\$\s*([\d.,\s]+)/i);
  const nMatriculados = nMatMatch ? parseNumeroAR(nMatMatch[1]) : null;

  const primerDolarMatch = raw.match(/\$\s*([\d.,\s]+)/);
  const ctaColeg = primerDolarMatch ? parseNumeroAR(primerDolarMatch[1]) : null;

  if (nMatriculados != null && ctaColeg != null) {
    return { ctaColeg, nMatriculados };
  }
  if (ctaColeg != null) {
    return { ctaColeg, nMatriculados: null };
  }
  return { ctaColeg: importeTotal, nMatriculados: null };
}

function parseNumeroAR(str: string): number | null {
  const normalized = (str ?? "").replace(/\s/g, "").replace(/\./g, "").replace(",", ".");
  const n = parseFloat(normalized);
  return Number.isNaN(n) ? null : n;
}
