"use client";

import type { FilaPlanilla } from "./PlanillaEditable";
import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

type Props = {
  planilla: FilaPlanilla[];
  onExport?: () => void;
};

function codeToExcel(v: string): number | null {
  if (v === "-" || v === "" || v == null) return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
}

function downloadExcel(planilla: FilaPlanilla[], nombre: string) {
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
    [
      "Legajo",
      "Apellido y Nombre",
      "FERIADO",
      "DIA UTEDYC",
      "CARPETA",
      "VACACIONES",
      "ADELANTO",
      "OTROS",
      "OBSERVACION",
    ],
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
  XLSX.writeFile(wb, (nombre || "NOVEDADES") + ".xlsx");
}

function downloadPdf(planilla: FilaPlanilla[], nombre: string) {
  const doc = new jsPDF({ orientation: "landscape" });
  doc.setFontSize(10);
  doc.text(nombre || "Novedades Liquidadores", 14, 12);
  doc.text(`Fecha: ${new Date().toLocaleDateString("es-AR")}`, 14, 18);

  const headers = [
    "Legajo",
    "Apellido y Nombre",
    "FERIADO",
    "DIA UTEDYC",
    "CARPETA",
    "VACACIONES",
    "ADELANTO",
    "OTROS",
    "OBSERVACION",
  ];
  const rows = planilla.map((f) => [
    String(f.numeroLegajo ?? ""),
    f.apellidoNombre ?? "",
    f.feriado ?? "-",
    f.diaUtedyc ?? "-",
    f.carpeta ?? "-",
    f.vacaciones ?? "-",
    f.adelanto ?? "-",
    f.otros ?? "-",
    f.observacion ?? "-",
  ]);

  autoTable(doc, {
    head: [headers],
    body: rows,
    startY: 24,
    styles: { fontSize: 7 },
    margin: { left: 14 },
  });

  doc.save((nombre || "NOVEDADES") + ".pdf");
}

export function ExportButtons({ planilla, onExport }: Props) {
  const nombreDefault = (() => {
    const n = new Date();
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}__NOVEDADES`;
  })();
  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        onClick={() => downloadExcel(planilla, nombreDefault)}
        className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-3 py-2 text-sm font-medium text-white hover:bg-green-700"
      >
        Exportar Excel - Todos
      </button>
      <button
        type="button"
        onClick={() => downloadPdf(planilla, nombreDefault)}
        className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700"
      >
        Exportar PDF - Todos
      </button>
    </div>
  );
}

export function ExportFilaButtons({
  fila,
  rowIndex,
}: {
  fila: FilaPlanilla;
  rowIndex: number;
}) {
  const nombre = `NOVEDADES_${fila.numeroLegajo || rowIndex}`;

  return (
    <div className="flex gap-1">
      <button
        type="button"
        onClick={() => downloadExcel([fila], nombre)}
        className="rounded border border-green-600 px-2 py-1 text-xs text-green-700 hover:bg-green-50"
      >
        XLS
      </button>
      <button
        type="button"
        onClick={() => downloadPdf([fila], nombre)}
        className="rounded border border-red-600 px-2 py-1 text-xs text-red-700 hover:bg-red-50"
      >
        PDF
      </button>
    </div>
  );
}
