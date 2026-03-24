import type { TsdEstado } from "@prisma/client";

export const TSD_ESTADO_OPTIONS: { value: TsdEstado; label: string }[] = [
  { value: "PARA_TRATAR", label: "Para Tratar" },
  { value: "CEDULA_NOTIFICACION", label: "Cédula Notificación" },
  { value: "APELACION", label: "Apelación" },
  { value: "DEVUELTO_A_DTO", label: "Devuelto a Dto." },
  { value: "SENTENCIA", label: "Sentencia" },
];

export function tsdEstadoLabel(estado: TsdEstado): string {
  return TSD_ESTADO_OPTIONS.find((o) => o.value === estado)?.label ?? estado;
}

/** Badge por especificación: azul, amarillo, naranja, verde */
export function tsdEstadoBadgeClass(estado: TsdEstado): string {
  switch (estado) {
    case "PARA_TRATAR":
      return "bg-blue-100 text-blue-800 border border-blue-200";
    case "CEDULA_NOTIFICACION":
      return "bg-amber-100 text-amber-900 border border-amber-200";
    case "APELACION":
      return "bg-orange-100 text-orange-900 border border-orange-200";
    case "DEVUELTO_A_DTO":
      return "bg-emerald-100 text-emerald-800 border border-emerald-200";
    case "SENTENCIA":
      return "bg-violet-100 text-violet-900 border border-violet-200";
    default:
      return "bg-gray-100 text-gray-800 border border-gray-200";
  }
}

export function formatTsdFecha(d: Date): string {
  return d.toLocaleDateString("es-AR", { timeZone: "America/Argentina/Buenos_Aires" });
}

export function hoyParaNombreArchivo(): string {
  const d = new Date();
  const p = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const y = p.find((x) => x.type === "year")?.value ?? "";
  const m = p.find((x) => x.type === "month")?.value ?? "";
  const day = p.find((x) => x.type === "day")?.value ?? "";
  return `${y}-${m}-${day}`;
}

export function sanitizarNombreArchivo(s: string): string {
  return s.replace(/[/\\?%*:|"<>]/g, "-").slice(0, 80);
}
