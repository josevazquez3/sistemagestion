"use client";

import { useState, useRef, useEffect } from "react";
import { Download, ChevronDown, FileSpreadsheet, FileText } from "lucide-react";
import type { FilaConciliacion, ResumenConciliacion } from "@/types/conciliacion";
import {
  exportarConciliacionExcel,
  exportarConciliacionPdf,
} from "@/lib/exportarConciliacion";

interface Props {
  filas: FilaConciliacion[];
  resumen: ResumenConciliacion;
  mes: number;
  anio: number;
  showMessage: (tipo: "ok" | "error", text: string) => void;
  disabled?: boolean;
}

export function BotonesExportar({
  filas,
  resumen,
  mes,
  anio,
  showMessage,
  disabled,
}: Props) {
  const [abierto, setAbierto] = useState(false);
  const [exportando, setExportando] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setAbierto(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleExcel = async () => {
    setAbierto(false);
    setExportando(true);
    try {
      await exportarConciliacionExcel(filas, resumen, mes, anio);
      showMessage("ok", "Archivo Excel generado correctamente.");
    } catch {
      showMessage("error", "Error al generar el Excel.");
    } finally {
      setExportando(false);
    }
  };

  const handlePdf = async () => {
    setAbierto(false);
    setExportando(true);
    try {
      await exportarConciliacionPdf(filas, resumen, mes, anio);
      showMessage("ok", "PDF generado correctamente.");
    } catch {
      showMessage("error", "Error al generar el PDF.");
    } finally {
      setExportando(false);
    }
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setAbierto((p) => !p)}
        disabled={disabled || exportando || filas.length === 0}
        className="flex items-center gap-2 rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {exportando ? (
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
        ) : (
          <Download className="h-4 w-4" />
        )}
        Exportar
        <ChevronDown className={`h-4 w-4 transition-transform ${abierto ? "rotate-180" : ""}`} />
      </button>

      {abierto && (
        <div className="absolute right-0 top-full z-50 mt-1 min-w-[160px] overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg">
          <button
            type="button"
            onClick={() => void handleExcel()}
            className="flex w-full items-center gap-2.5 px-4 py-3 text-sm text-gray-700 transition-colors hover:bg-gray-50"
          >
            <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
            Excel (.xlsx)
          </button>
          <button
            type="button"
            onClick={() => void handlePdf()}
            className="flex w-full items-center gap-2.5 border-t border-gray-100 px-4 py-3 text-sm text-gray-700 transition-colors hover:bg-gray-50"
          >
            <FileText className="h-4 w-4 text-red-500" />
            PDF
          </button>
        </div>
      )}
    </div>
  );
}
