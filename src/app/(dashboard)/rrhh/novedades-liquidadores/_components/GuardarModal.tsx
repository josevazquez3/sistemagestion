"use client";

import { useState, useEffect } from "react";
import * as XLSX from "xlsx";
import type { FilaPlanilla } from "./PlanillaEditable";
import { InputFecha } from "@/components/ui/InputFecha";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  diasTotales: number;
  planilla: FilaPlanilla[];
  periodo?: string;
  onSuccess: () => void;
  showMessage: (msg: string, type: "success" | "error") => void;
};

function defaultNombreArchivo(periodo?: string) {
  if (periodo && /^\d{4}-\d{2}$/.test(periodo)) return `${periodo}__NOVEDADES`;
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}__NOVEDADES`;
}

export function GuardarModal(
  props: Props
) {
  const { open, onOpenChange, diasTotales, planilla, periodo, onSuccess, showMessage } = props;
  const [nombreArchivo, setNombreArchivo] = useState("");
  const [fecha, setFecha] = useState("");
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (open) {
      setNombreArchivo(defaultNombreArchivo(periodo));
      const hoy = new Date();
      setFecha(
        String(hoy.getDate()).padStart(2, "0") +
          "/" +
          String(hoy.getMonth() + 1).padStart(2, "0") +
          "/" +
          hoy.getFullYear()
      );
    }
  }, [open, periodo]);

  const codeToExcel = (v: string): number | null => {
    if (v === "-" || v === "" || v == null) return null;
    const n = Number(v);
    return Number.isNaN(n) ? null : n;
  };

  const handleGuardar = () => {
    setGuardando(true);
    try {
      const filasLimpias = planilla.filter(
        (f) =>
          f.numeroLegajo ||
          f.apellidoNombre ||
          f.vacaciones !== "-" ||
          f.feriado !== "-" ||
          f.diaUtedyc !== "-" ||
          f.carpeta !== "-" ||
          f.adelanto !== "-" ||
          (f.observacion && f.observacion !== "-")
      );
      const wsData: (string | number | null)[][] = [
        ["Legajo", "Apellido y Nombre", "FERIADO", "DIA UTEDYC", "CARPETA", "VACACIONES", "ADELANTO", "OTROS", "OBSERVACION"],
        [null, null, 2611, 2601, 2641, 2501, 7311, null, null],
        ...filasLimpias.map((f) => [
          f.numeroLegajo || null,
          f.apellidoNombre || null,
          codeToExcel(f.feriado),
          codeToExcel(f.diaUtedyc),
          codeToExcel(f.carpeta),
          codeToExcel(f.vacaciones),
          codeToExcel(f.adelanto),
          codeToExcel(f.otros),
          f.observacion && f.observacion !== "-" ? f.observacion : null,
        ]),
      ];
      const ws = XLSX.utils.aoa_to_sheet(wsData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "NOVEDADES");
      const nombre = (nombreArchivo.trim() || defaultNombreArchivo(periodo)) + ".xlsx";
      XLSX.writeFile(wb, nombre);
      showMessage("Planilla exportada correctamente.", "success");
      onSuccess();
      onOpenChange(false);
    } catch (e) {
      showMessage("Error al exportar Excel.", "error");
      console.error(e);
    } finally {
      setGuardando(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/50"
        onClick={() => onOpenChange(false)}
        aria-hidden
      />
      <div className="relative z-10 w-full max-w-md rounded-xl border border-gray-200 bg-white p-6 shadow-xl">
        <h3 className="text-lg font-semibold text-gray-800">Guardar Novedades</h3>
        <div className="mt-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Nombre del archivo</label>
            <input
              type="text"
              value={nombreArchivo}
              onChange={(e) => setNombreArchivo(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
              placeholder="2026-02__NOVEDADES"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Fecha</label>
            <InputFecha
              value={fecha}
              onChange={setFecha}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
              placeholder="DD/MM/YYYY"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Días para liquidar</label>
            <input
              type="text"
              readOnly
              value={diasTotales}
              className="mt-1 w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-600"
            />
            <p className="mt-1 text-xs text-gray-500">Suma de días pendientes de la planilla actual.</p>
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleGuardar}
            disabled={guardando}
            className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
          >
            {guardando ? "Exportando..." : "Guardar y Exportar"}
          </button>
        </div>
      </div>
    </div>
  );
}
