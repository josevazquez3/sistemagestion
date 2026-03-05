"use client";

import { useCallback, useState, useEffect } from "react";
import Calendar from "react-calendar";
import "react-calendar/dist/Calendar.css";
import { cn } from "@/lib/utils";
import { EstadoVacaciones } from "@prisma/client";
import { normalizarFecha } from "@/lib/vacaciones.utils";

/** Formato YYYY-MM-DD para input type="date" */
function formatoInputDate(fecha: Date): string {
  const y = fecha.getFullYear();
  const m = String(fecha.getMonth() + 1).padStart(2, "0");
  const d = String(fecha.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

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
  const [activeStartDate, setActiveStartDate] = useState<Date>(() => {
    const d = value[0] ?? new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  useEffect(() => {
    if (value[0]) {
      const d = value[0];
      setActiveStartDate((prev) => {
        const sameMonth =
          prev.getFullYear() === d.getFullYear() && prev.getMonth() === d.getMonth();
        return sameMonth ? prev : new Date(d.getFullYear(), d.getMonth(), 1);
      });
    }
  }, [value[0]?.getTime()]);

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
      const norm1 = d1 ? normalizarFecha(d1) : null;
      const norm2 = d2 ? normalizarFecha(d2) : null;
      if (norm1 && !norm2) {
        onChange([norm1, norm1]);
        return;
      }
      onChange([norm1, norm2]);
    },
    [disabled, onChange]
  );

  const setActiveDateCalendario = useCallback((fecha: Date) => {
    setActiveStartDate(new Date(fecha.getFullYear(), fecha.getMonth(), 1));
  }, []);

  const handleCambioDesde = useCallback(
    (valor: string) => {
      if (disabled) return;
      if (!valor.trim()) {
        onChange([null, null]);
        return;
      }
      const fecha = normalizarFecha(new Date(valor + "T12:00:00"));
      const nuevaHasta =
        hasta && hasta >= fecha ? hasta : fecha;
      setActiveDateCalendario(fecha);
      onChange([fecha, nuevaHasta]);
    },
    [disabled, hasta, onChange, setActiveDateCalendario]
  );

  const handleCambioHasta = useCallback(
    (valor: string) => {
      if (disabled) return;
      if (!valor.trim()) {
        if (desde) {
          onChange([desde, desde]);
        }
        return;
      }
      const fecha = normalizarFecha(new Date(valor + "T12:00:00"));
      if (desde && fecha < desde) {
        onChange([fecha, desde]);
        setActiveDateCalendario(fecha);
        return;
      }
      setActiveDateCalendario(fecha);
      onChange([desde ?? fecha, fecha]);
    },
    [disabled, desde, onChange, setActiveDateCalendario]
  );

  return (
    <div className={cn("vacaciones-calendar space-y-3", disabled && "pointer-events-none opacity-60")}>
      <div className="flex flex-wrap gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1">
            Desde
          </label>
          <input
            type="date"
            value={desde ? formatoInputDate(desde) : ""}
            onChange={(e) => handleCambioDesde(e.target.value)}
            disabled={disabled}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1">
            Hasta
          </label>
          <input
            type="date"
            value={hasta ? formatoInputDate(hasta) : ""}
            onChange={(e) => handleCambioHasta(e.target.value)}
            disabled={disabled}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          />
        </div>
      </div>
      <Calendar
        selectRange
        value={value}
        onChange={handleChange}
        activeStartDate={activeStartDate}
        onActiveStartDateChange={({ activeStartDate: next }) =>
          next && setActiveStartDate(next)
        }
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
