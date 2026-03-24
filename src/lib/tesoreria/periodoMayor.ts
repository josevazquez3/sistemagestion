import { formatearFechaUTC, parsearFechaSegura } from "@/lib/utils/fecha";

/** DD/MM/YYYY → YYYY-MM-DD para query API */
export function ddmmyyyyToIsoYmd(s: string): string | null {
  const d = parsearFechaSegura(s.trim());
  if (!d) return null;
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Primer y último día del mes calendario actual (local) en DD/MM/YYYY UTC-día. */
export function primerUltimoDiaMesActualDdmm(): { desde: string; hasta: string } {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth() + 1;
  const first = new Date(Date.UTC(y, m - 1, 1, 12, 0, 0, 0));
  const last = new Date(Date.UTC(y, m, 0, 12, 0, 0, 0));
  return {
    desde: formatearFechaUTC(first),
    hasta: formatearFechaUTC(last),
  };
}

/** Meses (mes 1-12, año) que intersectan el rango [inicio, fin] por día UTC. */
export function mesesCubrenRangoUtc(inicio: Date, fin: Date): { mes: number; anio: number }[] {
  const out: { mes: number; anio: number }[] = [];
  const key = (yy: number, mm: number) => yy * 12 + mm;
  let y = inicio.getUTCFullYear();
  let m = inicio.getUTCMonth() + 1;
  const endKey = key(fin.getUTCFullYear(), fin.getUTCMonth() + 1);
  while (key(y, m) <= endKey) {
    out.push({ mes: m, anio: y });
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return out;
}

export function fechaIsoSoloDiaEnRangoUtc(
  iso: string,
  inicio: Date,
  fin: Date
): boolean {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return false;
  const t = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  const t0 = Date.UTC(
    inicio.getUTCFullYear(),
    inicio.getUTCMonth(),
    inicio.getUTCDate()
  );
  const t1 = Date.UTC(fin.getUTCFullYear(), fin.getUTCMonth(), fin.getUTCDate());
  return t >= t0 && t <= t1;
}
