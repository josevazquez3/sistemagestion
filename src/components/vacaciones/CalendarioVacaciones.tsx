"use client";

import { useCallback } from "react";
import Calendar from "react-calendar";
import "react-calendar/dist/Calendar.css";
import { cn } from "@/lib/utils";

export type EstadoVacaciones = "PENDIENTE" | "APROBADA" | "BAJA";

export interface SolicitudCalendario {
  fechaDesde: Date;
  fechaHasta: Date;
  estado: EstadoVacaciones;
}

export type RangoFechas = [Date | null, Date | null];

interface CalendarioVacacionesProps {
  /** Rango seleccionado actualmente (antes de guardar) */
  value: RangoFechas;
  /** Callback cuando el usuario selecciona un rango */
  onChange: (value: RangoFechas) => void;
  /** Solicitudes guardadas para colorear el calendario */
  solicitudes: SolicitudCalendario[];
  /** Si true, deshabilita la interacción (ej. sin configuración cargada) */
  disabled?: boolean;
  /** Locale para el calendario (ej. "es-AR") */
  locale?: string;
}

/** Normaliza una fecha a YYYY-MM-DD para comparación sin hora */
function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Indica si una fecha está dentro de un rango (inclusive) */
function fechaEnRango(fecha: Date, desde: Date, hasta: Date): boolean {
  const t = new Date(fecha).getTime();
  const d = new Date(desde);
  const h = new Date(hasta);
  d.setHours(0, 0, 0, 0);
  h.setHours(23, 59, 59, 999);
  return t >= d.getTime() && t <= h.getTime();
}

/** Devuelve el estado de la solicitud que cubre esta fecha, o null */
function estadoEnFecha(
  fecha: Date,
  solicitudes: SolicitudCalendario[]
): EstadoVacaciones | null {
  const s = solicitudes.find((sol) =>
    fechaEnRango(fecha, sol.fechaDesde, sol.fechaHasta)
  );
  return s ? s.estado : null;
}

export function CalendarioVacaciones({
  value,
  onChange,
  solicitudes,
  disabled = false,
  locale = "es-AR",
}: CalendarioVacacionesProps) {
  const [desde, hasta] = value;

  const tileClassName = useCallback(
    ({ date, view }: { date: Date; view: string }) => {
      if (view !== "month") return null;

      const clases: string[] = [];

      // Selección actual del usuario (antes de guardar)
      if (desde && hasta && fechaEnRango(date, desde, hasta)) {
        clases.push("!bg-green-200");
      }
      // También si solo hay "desde" (selección parcial)
      else if (desde && !hasta && toDateKey(date) === toDateKey(desde)) {
        clases.push("!bg-green-200");
      }

      const estado = estadoEnFecha(date, solicitudes);
      if (estado && !clases.includes("!bg-green-200")) {
        if (estado === "APROBADA") {
          clases.push("!bg-green-600 !text-white"); // verde oscuro
        } else if (estado === "PENDIENTE") {
          clases.push("!bg-green-400 !text-white"); // verde medio
        } else if (estado === "BAJA") {
          clases.push("!bg-red-200 !line-through");
        }
      }

      return clases.length > 0 ? cn(clases) : null;
    },
    [desde, hasta, solicitudes]
  );

  const handleChange = useCallback(
    (v: RangoFechas | Date | null) => {
      if (disabled) return;
      if (v === null) {
        onChange([null, null]);
        return;
      }
      const arr = Array.isArray(v) ? v : [v, v];
      const d1 = arr[0] instanceof Date ? arr[0] : null;
      const d2 = arr[1] instanceof Date ? arr[1] : null;
      onChange([d1, d2]);
    },
    [disabled, onChange]
  );

  return (
    <div className={cn("vacaciones-calendar", disabled && "pointer-events-none opacity-60")}>
      <Calendar
        selectRange
        value={value}
        onChange={handleChange}
        tileClassName={tileClassName}
        locale={locale}
        formatShortWeekday={(_, date) =>
          date.toLocaleDateString(locale, { weekday: "narrow" })
        }
        allowPartialRange
        minDetail="month"
        maxDetail="month"
        showNeighboringMonth={false}
        className="rounded-lg border border-border p-2 text-sm [&_.react-calendar__tile]:p-2 [&_.react-calendar__tile]:rounded [&_.react-calendar__month-view__days__day]:min-h-[2.5rem]"
      />
    </div>
  );
}
