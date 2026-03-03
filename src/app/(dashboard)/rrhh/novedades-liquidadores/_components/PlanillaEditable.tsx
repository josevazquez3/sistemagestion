"use client";

import { Trash2, UserPlus } from "lucide-react";
import { ExportFilaButtons } from "./ExportButtons";

export type FilaPlanilla = {
  legajoId: string;
  numeroLegajo: number;
  apellidoNombre: string;
  feriado: string;
  diaUtedyc: string;
  carpeta: string;
  vacaciones: string;
  adelanto: string;
  otros: string;
  observacion: string;
  novedadIds: string[];
};

type Props = {
  planilla: FilaPlanilla[];
  loading: boolean;
  onPlanillaChange: (planilla: FilaPlanilla[]) => void;
  onRefresh: () => void;
};

const COLS = [
  { key: "numeroLegajo", label: "Legajo", sub: "-", width: "w-20" },
  { key: "apellidoNombre", label: "Apellido y Nombre", sub: "-", width: "w-48" },
  { key: "feriado", label: "FERIADO", sub: "2611", width: "w-24" },
  { key: "diaUtedyc", label: "DIA UTEDYC", sub: "2601", width: "w-24" },
  { key: "carpeta", label: "CARPETA", sub: "2641", width: "w-24" },
  { key: "vacaciones", label: "VACACIONES", sub: "2501", width: "w-24" },
  { key: "adelanto", label: "ADELANTO", sub: "7311", width: "w-24" },
  { key: "otros", label: "OTROS", sub: "-", width: "w-24" },
  { key: "observacion", label: "OBSERVACION", sub: "-", width: "w-44" },
] as const;

export function PlanillaEditable({
  planilla,
  loading,
  onPlanillaChange,
  onRefresh,
}: Props) {
  const updateCell = (rowIndex: number, field: keyof FilaPlanilla, value: string) => {
    const next = [...planilla];
    const row = { ...next[rowIndex], [field]: value };
    next[rowIndex] = row;
    onPlanillaChange(next);
  };

  const removeRow = (rowIndex: number) => {
    const next = planilla.filter((_, i) => i !== rowIndex);
    onPlanillaChange(next);
  };

  const addRow = () => {
    onPlanillaChange([
      ...planilla,
      {
        legajoId: "",
        numeroLegajo: 0,
        apellidoNombre: "",
        feriado: "-",
        diaUtedyc: "-",
        carpeta: "-",
        vacaciones: "-",
        adelanto: "-",
        otros: "-",
        observacion: "-",
        novedadIds: [],
      },
    ]);
  };

  if (loading) {
    return (
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-6 text-center text-gray-500">
        Cargando planilla...
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-100">
              {COLS.map((c) => (
                <th key={c.key} className={`px-2 py-2 font-medium text-gray-700 ${c.width}`}>
                  {c.label}
                </th>
              ))}
              <th className="w-12 px-2 py-2" />
            </tr>
            <tr className="border-b border-gray-200 bg-gray-50 text-gray-500">
              {COLS.map((c) => (
                <th key={c.key} className={`px-2 py-1 font-normal ${c.width}`}>
                  {c.sub}
                </th>
              ))}
              <th className="w-12 px-2 py-1" />
            </tr>
          </thead>
          <tbody>
            {planilla.map((fila, rowIndex) => (
              <tr key={rowIndex} className="border-b border-gray-100 hover:bg-blue-50/50">
                {COLS.map((col) => {
                  const key = col.key as keyof FilaPlanilla;
                  const value = fila[key];
                  const isNum = key === "numeroLegajo";
                  const displayValue =
                    typeof value === "number" ? (value === 0 ? "" : String(value)) : String(value ?? "");
                  return (
                    <td key={col.key} className={`px-2 py-1 ${col.width}`}>
                      <input
                        type="text"
                        value={displayValue}
                        onChange={(e) =>
                          updateCell(
                            rowIndex,
                            key,
                            isNum ? e.target.value.replace(/\D/g, "") || "" : e.target.value
                          )
                        }
                        className="w-full rounded border border-gray-200 bg-white px-2 py-1 text-gray-800 focus:border-blue-400 focus:outline-none"
                      />
                    </td>
                  );
                })}
                <td className="flex items-center gap-1 px-2 py-1">
                  <ExportFilaButtons fila={fila} rowIndex={rowIndex} />
                  <button
                    type="button"
                    onClick={() => removeRow(rowIndex)}
                    className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600"
                    title="Eliminar fila"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button
        type="button"
        onClick={addRow}
        className="inline-flex items-center gap-2 rounded-lg border border-dashed border-gray-300 bg-gray-50 px-4 py-2 text-sm text-gray-600 hover:border-green-400 hover:bg-green-50 hover:text-green-700"
      >
        <UserPlus className="h-4 w-4" />
        Agregar empleado
      </button>
    </div>
  );
}
