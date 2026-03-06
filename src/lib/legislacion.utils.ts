/**
 * Formatea el valor del input de fecha para que siempre muestre DD/MM/YYYY con barras.
 * Solo permite dígitos y inserta las barras automáticamente.
 */
export function formatDateInputWithSlashes(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4, 8)}`;
}
