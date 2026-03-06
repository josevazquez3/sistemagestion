/**
 * Exportación individual de actas a PDF y DOCX (cliente).
 * Generación en el navegador, sin API adicional.
 */

import { jsPDF } from "jspdf";
import {
  Document,
  Paragraph,
  TextRun,
  Packer,
  HeadingLevel,
  AlignmentType,
} from "docx";
import type { Acta } from "@/components/secretaria/actas/types";

const TZ = "America/Argentina/Buenos_Aires";

const formatearFecha = (fecha: Date | string): string =>
  new Date(fecha).toLocaleDateString("es-AR", {
    timeZone: TZ,
  });

const formatearFechaHora = (fecha: Date | string): string =>
  new Date(fecha).toLocaleString("es-AR", {
    timeZone: TZ,
  });

const formatearFechaArchivo = (fecha: Date | string): string => {
  const d = new Date(fecha);
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
};

/**
 * Exporta un acta a PDF individual.
 */
export function exportarActaPDF(acta: Acta): void {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("CONSEJO SUPERIOR - COLEGIO DE MÉDICOS", 105, 20, { align: "center" });

  doc.setFontSize(13);
  doc.text("ACTA INSTITUCIONAL", 105, 30, { align: "center" });

  doc.setLineWidth(0.5);
  doc.line(14, 35, 196, 35);

  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.text(`Fecha del acta: ${formatearFecha(acta.fechaActa)}`, 14, 45);
  doc.text(`Fecha de carga: ${formatearFechaHora(acta.creadoEn)}`, 14, 53);

  if (acta.nombreArchivo) {
    doc.text(`Archivo adjunto: ${acta.nombreArchivo}`, 14, 61);
  }

  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("Título:", 14, 73);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  const lines = doc.splitTextToSize(acta.titulo, 176);
  doc.text(lines, 14, 83);

  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(9);
    doc.setTextColor(150, 150, 150);
    doc.text(
      `Generado el ${formatearFechaHora(new Date())} - Página ${i} de ${pageCount}`,
      105,
      287,
      { align: "center" }
    );
  }

  const nombreArchivo = `acta_${formatearFechaArchivo(acta.fechaActa)}.pdf`;
  doc.save(nombreArchivo);
}

/**
 * Exporta un acta a DOCX individual.
 */
export async function exportarActaDOCX(acta: Acta): Promise<void> {
  const doc = new Document({
    sections: [
      {
        children: [
          new Paragraph({
            text: "CONSEJO SUPERIOR - COLEGIO DE MÉDICOS",
            heading: HeadingLevel.HEADING_1,
            alignment: AlignmentType.CENTER,
          }),
          new Paragraph({
            text: "ACTA INSTITUCIONAL",
            heading: HeadingLevel.HEADING_2,
            alignment: AlignmentType.CENTER,
          }),
          new Paragraph({ text: "" }),
          new Paragraph({
            children: [
              new TextRun({ text: "Fecha del acta: ", bold: true }),
              new TextRun({ text: formatearFecha(acta.fechaActa) }),
            ],
          }),
          new Paragraph({
            children: [
              new TextRun({ text: "Fecha de carga: ", bold: true }),
              new TextRun({ text: formatearFechaHora(acta.creadoEn) }),
            ],
          }),
          ...(acta.nombreArchivo
            ? [
                new Paragraph({
                  children: [
                    new TextRun({ text: "Archivo adjunto: ", bold: true }),
                    new TextRun({ text: acta.nombreArchivo }),
                  ],
                }),
              ]
            : []),
          new Paragraph({ text: "" }),
          new Paragraph({
            children: [
              new TextRun({ text: "Título del acta:", bold: true, size: 24 }),
            ],
          }),
          new Paragraph({
            text: acta.titulo,
          }),
          new Paragraph({ text: "" }),
          new Paragraph({
            children: [
              new TextRun({
                text: `Generado el ${formatearFechaHora(new Date())}`,
                size: 18,
                color: "888888",
              }),
            ],
          }),
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `acta_${formatearFechaArchivo(acta.fechaActa)}.docx`;
  a.click();
  URL.revokeObjectURL(url);
}
