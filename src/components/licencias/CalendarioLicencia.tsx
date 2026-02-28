"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

const MESES_ES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
];
const DIA_SEMANA = ["Do", "Lu", "Ma", "Mi", "Ju", "Vi", "Sá"];

function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseDateKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export interface CalendarioLicenciaProps {
  /** Fechas seleccionadas (ISO YYYY-MM-DD) */
  diasMarcados: string[];
  /** Callback al cambiar la selección */
  onChange: (dias: string[]) => void;
  /** Callback cuando cambia el día mínimo (para Fecha de inicio) */
  onFechaInicioChange?: (fecha: string) => void;
  /** Callback cuando cambia el día máximo (para Fecha de finalización) */
  onFechaFinChange?: (fecha: string) => void;
  /** Mes/año a mostrar; si se pasa, el calendario navega a ese mes */
  mesActivo?: { año: number; mes: number };
  /** Deshabilitado */
  disabled?: boolean;
  /** Locale */
  locale?: string;
}

export function CalendarioLicencia({
  diasMarcados,
  onChange,
  onFechaInicioChange,
  onFechaFinChange,
  mesActivo,
  disabled = false,
}: CalendarioLicenciaProps) {
  const [vista, setVista] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d;
  });

  useEffect(() => {
    if (diasMarcados.length === 0) {
      onFechaInicioChange?.("");
      onFechaFinChange?.("");
      return;
    }
    const sorted = [...diasMarcados].sort();
    onFechaInicioChange?.(sorted[0]);
    onFechaFinChange?.(sorted[sorted.length - 1]);
  }, [diasMarcados, onFechaInicioChange, onFechaFinChange]);

  useEffect(() => {
    if (mesActivo == null) return;
    const { año, mes } = mesActivo;
    setVista(new Date(año, mes - 1, 1));
  }, [mesActivo?.año, mesActivo?.mes]);

  const set = useMemo(() => new Set(diasMarcados), [diasMarcados]);

  const toggleDia = useCallback(
    (key: string) => {
      if (disabled) return;
      const next = new Set(set);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      onChange(Array.from(next).sort());
    },
    [set, onChange, disabled]
  );

  const mesAnio = vista.getFullYear();
  const mesIndex = vista.getMonth();
  const primerDia = new Date(mesAnio, mesIndex, 1);
  const ultimoDia = new Date(mesAnio, mesIndex + 1, 0);
  const inicioSemana = primerDia.getDay();
  const diasEnMes = ultimoDia.getDate();

  const celdas: (string | null)[] = [];
  for (let i = 0; i < inicioSemana; i++) celdas.push(null);
  for (let d = 1; d <= diasEnMes; d++) {
    celdas.push(`${mesAnio}-${String(mesIndex + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
  }

  const anterior = () => {
    setVista((v) => {
      const n = new Date(v);
      n.setMonth(n.getMonth() - 1);
      return n;
    });
  };

  const siguiente = () => {
    setVista((v) => {
      const n = new Date(v);
      n.setMonth(n.getMonth() + 1);
      return n;
    });
  };

  const hoyKey = toDateKey(new Date());

  return (
    <div className={cn("rounded-xl border border-gray-200 bg-white p-4", disabled && "opacity-60 pointer-events-none")}>
      <div className="flex items-center justify-between mb-4">
        <button
          type="button"
          onClick={anterior}
          className="p-2 rounded-lg hover:bg-gray-100 text-gray-600"
          aria-label="Mes anterior"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <span className="font-semibold text-gray-800">
          {MESES_ES[mesIndex]} {mesAnio}
        </span>
        <button
          type="button"
          onClick={siguiente}
          className="p-2 rounded-lg hover:bg-gray-100 text-gray-600"
          aria-label="Mes siguiente"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center">
        {DIA_SEMANA.map((d) => (
          <div key={d} className="text-xs font-medium text-gray-500 py-1">
            {d}
          </div>
        ))}
        {celdas.map((key, i) => {
          if (!key) return <div key={`e-${i}`} />;
          const selected = set.has(key);
          const esHoy = key === hoyKey;
          return (
            <button
              key={key}
              type="button"
              onClick={() => toggleDia(key)}
              className={cn(
                "h-9 rounded-md text-sm transition-colors",
                selected && "bg-green-500 text-white hover:bg-green-600",
                !selected && "hover:bg-gray-100 text-gray-700",
                esHoy && !selected && "ring-1 ring-green-400"
              )}
            >
              {parseInt(key.split("-")[2], 10)}
            </button>
          );
        })}
      </div>
      <p className="text-xs text-gray-500 mt-2">
        Clic en un día para marcar o desmarcar. Días marcados en verde.
      </p>
    </div>
  );
}
