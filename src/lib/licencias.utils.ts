/**
 * Utilidades para el módulo de Licencias (RRHH).
 * Fechas en timezone Argentina (America/Argentina/Buenos_Aires).
 */

const TIMEZONE_AR = "America/Argentina/Buenos_Aires";

/**
 * Parsea una fecha de BD (UTC midnight) como fecha local sin aplicar offset horario.
 * Evita que al convertir "2026-03-20T00:00:00.000Z" en Argentina (UTC-3) se muestre 19/03.
 */
export function parsearFechaLocalDesdeBD(fecha: string | Date): Date {
  const str = typeof fecha === "string" ? fecha : fecha.toISOString();
  const [anio, mes, dia] = str.slice(0, 10).split("-").map(Number);
  return new Date(anio, mes - 1, dia);
}

/**
 * Formatea una fecha en formato DD/MM/YYYY (Argentina), interpretando la fecha de BD como local.
 */
export function formatearFechaLicencia(fecha: Date | string): string {
  const d = parsearFechaLocalDesdeBD(fecha);
  return d.toLocaleDateString("es-AR", { timeZone: TIMEZONE_AR });
}

/**
 * Convierte una fecha local a inicio del día en Argentina.
 */
export function toArgentinaDate(date: Date): Date {
  const str = date.toLocaleDateString("en-CA", { timeZone: TIMEZONE_AR });
  return new Date(str + "T12:00:00.000Z");
}

/**
 * Días transcurridos desde una fecha hasta hoy (Argentina).
 */
export function diasTranscurridos(desde: Date): number {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const d = new Date(desde);
  d.setHours(0, 0, 0, 0);
  const diff = hoy.getTime() - d.getTime();
  return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
}

/**
 * Días restantes desde hoy hasta la fecha de fin (Argentina).
 * Si fechaFin es null o ya pasó, retorna 0 o negativo (el cliente puede mostrar "VENCIDA").
 */
export function diasRestantes(fechaFin: Date | null): number | null {
  if (!fechaFin) return null;
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const fin = new Date(fechaFin);
  fin.setHours(0, 0, 0, 0);
  const diff = fin.getTime() - hoy.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

/**
 * Etiquetas en español para TipoLicencia.
 */
export const TIPO_LICENCIA_LABEL: Record<string, string> = {
  ART: "ART (Accidente de Trabajo)",
  ENFERMEDAD: "Enfermedad",
  ESTUDIO: "Estudio",
  MATERNIDAD: "Maternidad",
  PATERNIDAD: "Paternidad",
};

/**
 * Etiquetas para EstadoLicencia.
 */
export const ESTADO_LICENCIA_LABEL: Record<string, string> = {
  ACTIVA: "Activa",
  FINALIZADA: "Finalizada",
};
