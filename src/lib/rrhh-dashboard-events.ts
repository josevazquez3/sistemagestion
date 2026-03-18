/** Evento global para que el dashboard (p. ej. Novedades Liquidadores) vuelva a pedir datos. */
export const NOVEDADES_LIQUIDADORES_REFRESH = "rrhh:novedades-liquidadores-refresh";

export function emitNovedadesLiquidadoresRefresh(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(NOVEDADES_LIQUIDADORES_REFRESH));
}
