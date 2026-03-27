import {
  AlignmentType,
  BorderStyle,
  Document,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
  ShadingType,
} from "docx";
import { formatearFechaUTC } from "@/lib/utils/fecha";

export type TemaExport = {
  numero: number;
  fechaIso: string;
  tema: string;
  observacion: string | null;
  fechaODIso: string | null;
  guiaMesaIso: string | null;
  cantOD: number;
  cantGuia: number;
  asignacionTexto: string;
  estado: "PENDIENTE" | "FINALIZADO";
};

function cellText(text: string, opts?: { bold?: boolean; shading?: string }) {
  return new TableCell({
    width: { size: 100, type: WidthType.AUTO },
    shading: opts?.shading
      ? { type: ShadingType.CLEAR, color: "auto", fill: opts.shading }
      : undefined,
    children: [
      new Paragraph({
        children: [new TextRun({ text, bold: !!opts?.bold })],
      }),
    ],
  });
}

function headerRow() {
  const fill = "E5E7EB"; // gris claro
  return new TableRow({
    children: [
      cellText("#", { bold: true, shading: fill }),
      cellText("Fecha", { bold: true, shading: fill }),
      cellText("Tema", { bold: true, shading: fill }),
      cellText("Observación", { bold: true, shading: fill }),
      cellText("Fecha OD", { bold: true, shading: fill }),
      cellText("Guia Mesa", { bold: true, shading: fill }),
      cellText("Cant. OD", { bold: true, shading: fill }),
      cellText("Cant. Guía", { bold: true, shading: fill }),
      cellText("Asignación", { bold: true, shading: fill }),
      cellText("Estado", { bold: true, shading: fill }),
    ],
  });
}

function fmt(iso: string | null) {
  if (!iso) return "—";
  try {
    return formatearFechaUTC(new Date(iso));
  } catch {
    return "—";
  }
}

export async function exportarTemasDocx(temas: TemaExport[]) {
  const hoy = formatearFechaUTC(new Date());

  const rows: TableRow[] = [
    headerRow(),
    ...temas
      .slice()
      .sort((a, b) => a.numero - b.numero)
      .map((t) => {
        const finalizado = t.estado === "FINALIZADO";
        const fill = finalizado ? "D1FAE5" : undefined; // verde claro
        return new TableRow({
          children: [
            cellText(String(t.numero), { shading: fill }),
            cellText(fmt(t.fechaIso), { shading: fill }),
            cellText(t.tema, { shading: fill }),
            cellText(t.observacion ?? "", { shading: fill }),
            cellText(fmt(t.fechaODIso), { shading: fill }),
            cellText(fmt(t.guiaMesaIso), { shading: fill }),
            cellText(String(t.cantOD), { shading: fill }),
            cellText(String(t.cantGuia), { shading: fill }),
            cellText(t.asignacionTexto, { shading: fill }),
            cellText(finalizado ? "FINALIZADO" : "PENDIENTE", { shading: fill }),
          ],
        });
      }),
  ];

  const table = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows,
    borders: {
      top: { style: BorderStyle.SINGLE, size: 1, color: "D1D5DB" },
      bottom: { style: BorderStyle.SINGLE, size: 1, color: "D1D5DB" },
      left: { style: BorderStyle.SINGLE, size: 1, color: "D1D5DB" },
      right: { style: BorderStyle.SINGLE, size: 1, color: "D1D5DB" },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: "E5E7EB" },
      insideVertical: { style: BorderStyle.SINGLE, size: 1, color: "E5E7EB" },
    },
  });

  const doc = new Document({
    sections: [
      {
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: "LISTADO DE TEMAS - SECRETARÍA", bold: true })],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 200 },
            children: [new TextRun({ text: `Fecha de exportación: ${hoy}` })],
          }),
          table,
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `Temas_Secretaria_${hoy.replace(/\//g, "")}.docx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

