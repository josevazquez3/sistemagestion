/**
 * Utilidades para el módulo de Licencias (RRHH).
 * Fechas en timezone Argentina (America/Argentina/Buenos_Aires).
 */

const TIMEZONE_AR = "America/Argentina/Buenos_Aires";

/**
 * Formatea una fecha en formato DD/MM/YYYY (Argentina).
 */
export function formatearFechaLicencia(fecha: Date): string {
  const d = new Date(fecha);
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
