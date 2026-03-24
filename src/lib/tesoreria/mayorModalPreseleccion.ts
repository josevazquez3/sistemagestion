import { matchCuentaPorReglas, type ReglaMatchInput } from "./mayorReglasTexto";

export function preseleccionarMovsPorReglas(
  movimientos: { id: number; concepto: string }[],
  idsYaAsignados: Set<number>,
  reglas: ReglaMatchInput[]
): { seleccion: Record<number, string>; esAuto: Record<number, boolean> } {
  const seleccion: Record<number, string> = {};
  const esAuto: Record<number, boolean> = {};
  for (const m of movimientos) {
    if (idsYaAsignados.has(m.id)) continue;
    const hit = matchCuentaPorReglas(m.concepto, reglas);
    if (hit) {
      seleccion[m.id] = String(hit.cuentaId);
      esAuto[m.id] = true;
    }
  }
  return { seleccion, esAuto };
}
