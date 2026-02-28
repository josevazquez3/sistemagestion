/**
 * Exportación de Nómina de Licencias a PDF y DOCX.
 * Diseñado para ejecución en el cliente (navegador).
 */

import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType,
} from "docx";
import {
  formatearFechaLicencia,
  diasTranscurridos,
  diasRestantes,
  TIPO_LICENCIA_LABEL,
} from "@/lib/licencias.utils";

const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME ?? "Sistema de Gestión";

export type LicenciaNomina = {
  id: number;
  tipoLicencia: string;
  fechaInicio: string;
  fechaFin: string | null;
  legajo: { numeroLegajo: number; nombres: string; apellidos: string };
  observacionesNomina: { id: number; texto: string }[];
};

function observacionReciente(lic: LicenciaNomina): string {
  const obs = lic.observacionesNomina?.[0];
  return obs?.texto?.trim() || "";
}

function textoDiasRestantes(lic: LicenciaNomina): string {
  const fin = lic.fechaFin ? new Date(lic.fechaFin) : null;
  const rest = diasRestantes(fin);
  if (rest === null) return "—";
  if (rest < 0) return "VENCIDA";
  if (rest === 0) return "Vence hoy";
  return String(rest);
}

/**
 * Exporta todas las licencias de la nómina a PDF (cliente).
 */
export function exportarPDFTodos(licencias: LicenciaNomina[]): void {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const fechaGen = formatearFechaLicencia(new Date());

  let y = 18;
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text(APP_NAME, 148, y, { align: "center" });
  y += 7;
  doc.setFontSize(12);
  doc.text("Nómina de Empleados con Licencia Activa", 148, y, { align: "center" });
  y += 6;
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`Fecha de generación: ${fechaGen}`, 148, y, { align: "center" });
  y += 12;

  const head = [
    "Legajo",
    "Nombre y Apellido",
    "Tipo de Licencia",
    "Fecha Inicio",
    "Fecha Fin",
    "Días transcurridos",
    "Días restantes",
    "Observaciones",
  ];
  const body = licencias.map((lic) => {
    const inicio = new Date(lic.fechaInicio);
    const trans = diasTranscurridos(inicio);
    const rest = textoDiasRestantes(lic);
    const obs = observacionReciente(lic);
    const obsCorta = obs.length > 60 ? obs.slice(0, 57) + "..." : obs || "Sin observaciones";
    return [
      String(lic.legajo.numeroLegajo),
      `${lic.legajo.apellidos}, ${lic.legajo.nombres}`,
      TIPO_LICENCIA_LABEL[lic.tipoLicencia] ?? lic.tipoLicencia,
      formatearFechaLicencia(inicio),
      lic.fechaFin ? formatearFechaLicencia(new Date(lic.fechaFin)) : "—",
      String(trans),
      rest,
      obsCorta,
    ];
  });

  autoTable(doc, {
    head: [head],
    body,
    startY: y,
    margin: { left: 14, right: 14 },
    theme: "grid",
    headStyles: { fontStyle: "bold", fontSize: 8 },
    bodyStyles: { fontSize: 7 },
    columnStyles: {
      6: { textColor: [180, 0, 0] },
      7: { cellWidth: 45 },
    },
  });

  doc.save(`nomina-licencias-${fechaGen.replace(/\//g, "-")}.pdf`);
}

/**
 * Exporta una sola licencia a PDF (cliente).
 */
export function exportarPDFIndividual(licencia: LicenciaNomina): void {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const fechaGen = formatearFechaLicencia(new Date());
  const inicio = new Date(licencia.fechaInicio);
  const trans = diasTranscurridos(inicio);
  const rest = textoDiasRestantes(licencia);
  const obs = observacionReciente(licencia);

  let y = 20;
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text(APP_NAME, 105, y, { align: "center" });
  y += 8;
  doc.text("Nómina de Empleados con Licencia Activa", 105, y, { align: "center" });
  y += 6;
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`Fecha de generación: ${fechaGen}`, 105, y, { align: "center" });
  y += 15;

  const datos = [
    ["Legajo", String(licencia.legajo.numeroLegajo)],
    ["Nombre y Apellido", `${licencia.legajo.apellidos}, ${licencia.legajo.nombres}`],
    ["Tipo de Licencia", TIPO_LICENCIA_LABEL[licencia.tipoLicencia] ?? licencia.tipoLicencia],
    ["Fecha Inicio", formatearFechaLicencia(inicio)],
    ["Fecha Fin", licencia.fechaFin ? formatearFechaLicencia(new Date(licencia.fechaFin)) : "—"],
    ["Días transcurridos", String(trans)],
    ["Días restantes", rest],
    ["Observaciones", obs || "Sin observaciones"],
  ];

  autoTable(doc, {
    body: datos,
    startY: y,
    margin: { left: 20, right: 20 },
    theme: "plain",
    columnStyles: { 0: { fontStyle: "bold", cellWidth: 55 }, 1: { cellWidth: 120 } },
    didParseCell: (data) => {
      if (data.column.index === 1 && data.row.index === 6) {
        data.cell.styles.textColor = [180, 0, 0];
        data.cell.styles.fontStyle = "bold";
      }
    },
  });

  doc.save(`licencia-${licencia.legajo.numeroLegajo}-${fechaGen.replace(/\//g, "-")}.pdf`);
}

/**
 * Exporta todas las licencias de la nómina a DOCX (cliente).
 */
export async function exportarDOCXTodos(licencias: LicenciaNomina[]): Promise<void> {
  const fechaGen = formatearFechaLicencia(new Date());

  const rows: TableRow[] = [
    new TableRow({
      children: [
        new TableCell({
          children: [new Paragraph({ text: "Legajo", alignment: AlignmentType.CENTER })],
          width: { size: 15, type: WidthType.PERCENTAGE },
          shading: { fill: "E5E7EB" },
        }),
        new TableCell({
          children: [new Paragraph({ text: "Nombre y Apellido", alignment: AlignmentType.CENTER })],
          width: { size: 22, type: WidthType.PERCENTAGE },
          shading: { fill: "E5E7EB" },
        }),
        new TableCell({
          children: [new Paragraph({ text: "Tipo Licencia", alignment: AlignmentType.CENTER })],
          width: { size: 18, type: WidthType.PERCENTAGE },
          shading: { fill: "E5E7EB" },
        }),
        new TableCell({
          children: [new Paragraph({ text: "Fecha Inicio", alignment: AlignmentType.CENTER })],
          width: { size: 12, type: WidthType.PERCENTAGE },
          shading: { fill: "E5E7EB" },
        }),
        new TableCell({
          children: [new Paragraph({ text: "Fecha Fin", alignment: AlignmentType.CENTER })],
          width: { size: 12, type: WidthType.PERCENTAGE },
          shading: { fill: "E5E7EB" },
        }),
        new TableCell({
          children: [new Paragraph({ text: "Días trans.", alignment: AlignmentType.CENTER })],
          width: { size: 8, type: WidthType.PERCENTAGE },
          shading: { fill: "E5E7EB" },
        }),
        new TableCell({
          children: [new Paragraph({ text: "Días rest.", alignment: AlignmentType.CENTER })],
          width: { size: 8, type: WidthType.PERCENTAGE },
          shading: { fill: "E5E7EB" },
        }),
        new TableCell({
          children: [new Paragraph({ text: "Observaciones", alignment: AlignmentType.CENTER })],
          width: { size: 15, type: WidthType.PERCENTAGE },
          shading: { fill: "E5E7EB" },
        }),
      ],
    }),
  ];

  for (const lic of licencias) {
    const inicio = new Date(lic.fechaInicio);
    const trans = diasTranscurridos(inicio);
    const rest = textoDiasRestantes(lic);
    const obs = observacionReciente(lic);
    const obsCorta = obs.length > 60 ? obs.slice(0, 57) + "..." : obs || "Sin observaciones";
    rows.push(
      new TableRow({
        children: [
          new TableCell({ children: [new Paragraph(String(lic.legajo.numeroLegajo))] }),
          new TableCell({ children: [new Paragraph(`${lic.legajo.apellidos}, ${lic.legajo.nombres}`)] }),
          new TableCell({ children: [new Paragraph(TIPO_LICENCIA_LABEL[lic.tipoLicencia] ?? lic.tipoLicencia)] }),
          new TableCell({ children: [new Paragraph(formatearFechaLicencia(inicio))] }),
          new TableCell({ children: [new Paragraph(lic.fechaFin ? formatearFechaLicencia(new Date(lic.fechaFin)) : "—")] }),
          new TableCell({ children: [new Paragraph(String(trans))] }),
          new TableCell({
            children: [new Paragraph({ children: [new TextRun({ text: rest, bold: true })] })],
          }),
          new TableCell({ children: [new Paragraph(obsCorta)] }),
        ],
      })
    );
  }

  const doc = new Document({
    sections: [
      {
        children: [
          new Paragraph({
            children: [new TextRun({ text: APP_NAME, bold: true, size: 28 })],
            alignment: AlignmentType.CENTER,
            spacing: { after: 200 },
          }),
          new Paragraph({
            children: [new TextRun({ text: "Nómina de Empleados con Licencia Activa", bold: true, size: 24 })],
            alignment: AlignmentType.CENTER,
            spacing: { after: 100 },
          }),
          new Paragraph({
            children: [new TextRun({ text: `Fecha de generación: ${fechaGen}`, size: 22 })],
            alignment: AlignmentType.CENTER,
            spacing: { after: 400 },
          }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows,
          }),
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `nomina-licencias-${fechaGen.replace(/\//g, "-")}.docx`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Exporta una sola licencia a DOCX (cliente).
 */
export async function exportarDOCXIndividual(licencia: LicenciaNomina): Promise<void> {
  const fechaGen = formatearFechaLicencia(new Date());
  const inicio = new Date(licencia.fechaInicio);
  const trans = diasTranscurridos(inicio);
  const rest = textoDiasRestantes(licencia);
  const obs = observacionReciente(licencia);

  const doc = new Document({
    sections: [
      {
        children: [
          new Paragraph({
            children: [new TextRun({ text: APP_NAME, bold: true, size: 28 })],
            alignment: AlignmentType.CENTER,
            spacing: { after: 200 },
          }),
          new Paragraph({
            children: [new TextRun({ text: "Nómina de Empleados con Licencia Activa", bold: true, size: 24 })],
            alignment: AlignmentType.CENTER,
            spacing: { after: 100 },
          }),
          new Paragraph({
            children: [new TextRun({ text: `Fecha de generación: ${fechaGen}`, size: 22 })],
            alignment: AlignmentType.CENTER,
            spacing: { after: 400 },
          }),
          new Paragraph({
            children: [new TextRun({ text: "Datos del empleado", bold: true, size: 24 })],
            spacing: { after: 200 },
          }),
          new Paragraph({ text: `Legajo: ${licencia.legajo.numeroLegajo}`, spacing: { after: 100 } }),
          new Paragraph({
            text: `Nombre y Apellido: ${licencia.legajo.apellidos}, ${licencia.legajo.nombres}`,
            spacing: { after: 100 },
          }),
          new Paragraph({
            text: `Tipo de Licencia: ${TIPO_LICENCIA_LABEL[licencia.tipoLicencia] ?? licencia.tipoLicencia}`,
            spacing: { after: 100 },
          }),
          new Paragraph({
            text: `Fecha Inicio: ${formatearFechaLicencia(inicio)}`,
            spacing: { after: 100 },
          }),
          new Paragraph({
            text: `Fecha Fin: ${licencia.fechaFin ? formatearFechaLicencia(new Date(licencia.fechaFin)) : "—"}`,
            spacing: { after: 100 },
          }),
          new Paragraph({ text: `Días transcurridos: ${trans}`, spacing: { after: 100 } }),
          new Paragraph({
            children: [new TextRun({ text: `Días restantes: ${rest}`, bold: true })],
            spacing: { after: 100 },
          }),
          new Paragraph({
            text: `Observaciones: ${obs || "Sin observaciones"}`,
            spacing: { after: 200 },
          }),
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `licencia-${licencia.legajo.numeroLegajo}-${fechaGen.replace(/\//g, "-")}.docx`;
  a.click();
  URL.revokeObjectURL(url);
}
