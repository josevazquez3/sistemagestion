/**
 * El campo codOperativo en cuentas bancarias puede ser varios códigos separados por espacio
 * (ej. "2377 3002 1253 2767"). Un movimiento del extracto trae un solo código; hay que matchear
 * por inclusión en esa lista, no por igualdad exacta del string completo.
 */

export function tokensCodOperativoCuenta(codOperativo: string | null | undefined): string[] {
  const s = (codOperativo ?? "")
    .replace(/\//g, " ")
    .replace(/\|/g, " ")
    .replace(/[\r\n]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return s.split(/\s+/).filter(Boolean);
}

export function encontrarCuentaPorCodigoMovimientoExtracto<
  T extends { codigo: string; codOperativo: string | null },
>(codMovimiento: string | null | undefined, cuentas: T[]): T | undefined {
  const c = (codMovimiento ?? "").trim();
  if (!c) return undefined;
  return cuentas.find((row) => {
    if (String(row.codigo ?? "").trim() === c) return true;
    return tokensCodOperativoCuenta(row.codOperativo).includes(c);
  });
}

/** Todos los códigos que “cubre” una cuenta (su codigo + cada token de codOperativo). */
export function tokensCubiertosPorCuentaBancaria(c: {
  codigo: string;
  codOperativo: string | null;
}): Set<string> {
  const s = new Set<string>();
  const cg = String(c.codigo ?? "").trim();
  if (cg) s.add(cg);
  tokensCodOperativoCuenta(c.codOperativo).forEach((t) => s.add(t));
  return s;
}
