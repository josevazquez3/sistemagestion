/**
 * Fechas “solo día” sin desfase por timezone (Vercel UTC vs clientes UTC-3).
 * Estrategia: mediodía UTC (12:00:00Z) para el día calendario elegido.
 */

const RX_DDMMYYYY = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
const RX_YYYYMMDD = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Parsea "DD/MM/YYYY" o "YYYY-MM-DD" → Date a mediodía UTC de ese día.
 * @returns null si el string es inválido
 */
export function parsearFechaSegura(str: string): Date | null {
  const trimmed = (str ?? "").trim();
  if (!trimmed) return null;

  let year: number;
  let month: number;
  let day: number;

  const mSlash = trimmed.match(RX_DDMMYYYY);
  if (mSlash) {
    day = parseInt(mSlash[1]!, 10);
    month = parseInt(mSlash[2]!, 10);
    year = parseInt(mSlash[3]!, 10);
  } else {
    const mDash = trimmed.match(RX_YYYYMMDD);
    if (!mDash) return null;
    year = parseInt(mDash[1]!, 10);
    month = parseInt(mDash[2]!, 10);
    day = parseInt(mDash[3]!, 10);
  }

  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  const t = Date.UTC(year, month - 1, day, 12, 0, 0, 0);
  const d = new Date(t);
  if (
    d.getUTCFullYear() !== year ||
    d.getUTCMonth() !== month - 1 ||
    d.getUTCDate() !== day
  ) {
    return null;
  }
  return d;
}

/** Date → "DD/MM/YYYY" usando componentes UTC (coherente con fechas guardadas al mediodía UTC). */
export function formatearFechaUTC(fecha: Date): string {
  const d = fecha.getUTCDate().toString().padStart(2, "0");
  const m = (fecha.getUTCMonth() + 1).toString().padStart(2, "0");
  const y = fecha.getUTCFullYear();
  return `${d}/${m}/${y}`;
}

/**
 * Normaliza cualquier Date o ISO string al mediodía UTC del mismo día calendario **en UTC**.
 * Útil para strings tipo "2026-04-15" o "2026-04-15T00:00:00.000Z".
 */
export function fechaSeguraParaPrisma(fecha: Date | string): Date {
  const d = typeof fecha === "string" ? new Date(fecha) : fecha;
  if (isNaN(d.getTime())) {
    return d;
  }
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 12, 0, 0, 0)
  );
}

/**
 * Componentes de calendario **locales** del usuario → mediodía UTC de ese día.
 * Usar en cliente con fechas de calendario / inputs antes de enviar al servidor.
 */
export function fechaLocalANoonUTC(d: Date): Date {
  return new Date(
    Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), 12, 0, 0, 0)
  );
}

/** Primer instante “día” del mes (mediodía UTC del día 1). */
export function primerDiaMesNoonUTC(anio: number, mes1a12: number): Date {
  return new Date(Date.UTC(anio, mes1a12 - 1, 1, 12, 0, 0, 0));
}

/** Mediodía UTC del último día del mes. */
export function ultimoDiaMesNoonUTC(anio: number, mes1a12: number): Date {
  const ultimo = new Date(Date.UTC(anio, mes1a12, 0, 12, 0, 0, 0));
  return ultimo;
}

/** Alias para rutas que ya usaban el nombre anterior */
export const parseFechaArgentina = parsearFechaSegura;

/** DD/MM/YY o DD/MM/YYYY */
export function parsearFechaSeguraFlexible(str: string): Date | null {
  const s = (str ?? "").trim();
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/);
  if (!m) return parsearFechaSegura(s);
  let y = parseInt(m[3]!, 10);
  if (y < 100) y += 2000;
  return parsearFechaSegura(`${m[1]}/${m[2]}/${y}`);
}

/**
 * Fecha enviada por API (DD/MM/YYYY, YYYY-MM-DD o ISO) → mediodía UTC del día.
 */
export function parsearFechaInputAPI(fecha: string): Date {
  const raw = (fecha ?? "").trim();
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(raw)) {
    const p = parsearFechaSegura(raw);
    if (p) return p;
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) {
    return fechaSeguraParaPrisma(raw.slice(0, 10));
  }
  const d = new Date(raw);
  if (isNaN(d.getTime())) return d;
  return fechaSeguraParaPrisma(d);
}
