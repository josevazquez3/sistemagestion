/** Moneda ARS en locale argentino (símbolo $, miles con punto, decimales con coma). */
export function fmtARS(n: number): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}
