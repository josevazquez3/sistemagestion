"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

const MESES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

interface Props {
  mes: number;
  anio: number;
  onChange: (mes: number, anio: number) => void;
}

export function CalendarioConciliacion({ mes, anio, onChange }: Props) {
  const anterior = () => {
    if (mes === 1) onChange(12, anio - 1);
    else onChange(mes - 1, anio);
  };
  const siguiente = () => {
    if (mes === 12) onChange(1, anio + 1);
    else onChange(mes + 1, anio);
  };

  return (
    <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-2.5 shadow-sm">
      <button
        type="button"
        onClick={anterior}
        className="rounded-lg p-1 transition-colors hover:bg-gray-100"
      >
        <ChevronLeft className="h-4 w-4 text-gray-500" />
      </button>
      <span className="min-w-[140px] text-center text-sm font-semibold text-gray-800">
        {MESES[mes - 1]} {anio}
      </span>
      <button
        type="button"
        onClick={siguiente}
        className="rounded-lg p-1 transition-colors hover:bg-gray-100"
      >
        <ChevronRight className="h-4 w-4 text-gray-500" />
      </button>
    </div>
  );
}
