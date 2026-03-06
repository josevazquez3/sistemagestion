/**
 * Exportación de Agenda (reuniones) a PDF y DOCX.
 * Global (todas según filtros) e individual por reunión.
 */

import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import {
  Document,
  Paragraph,
  TextRun,
  Packer,
  Table,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType,
  BorderStyle,
} from "docx";

const TZ = "America/Argentina/Buenos_Aires";

export type ReunionExport = {
  id: number;
  fechaCarga: string | Date;
  organismo: string;
  fechaReunion: string | Date;
  hora: string | null;
  observacion: string | null;
  estado?: string;
  contactoNombre: string | null;
  contactoApellido: string | null;
  contactoCargo: string | null;
  contactoTelefono: string | null;
  contactoMail: string | null;
};

const estadoLabel = (e: string | undefined): string =>
  e === "FINALIZADA" ? "Finalizada" : "Pendiente";

const formatearFecha = (fecha: Date | string): string =>
  new Date(fecha).toLocaleDateString("es-AR", { timeZone: TZ });

const formatearFechaHora = (fecha: Date | string): string =>
  new Date(fecha).toLocaleString("es-AR", { timeZone: TZ });

const formatearFechaArchivo = (fecha: Date | string): string => {
  const d = new Date(fecha);
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
};

/** Exportar todas las reuniones (filtradas) a PDF */
export function exportarAgendaPDF(reuniones: ReunionExport[]): void {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("CONSEJO SUPERIOR - COLEGIO DE MÉDICOS", 148, 15, { align: "center" });
  doc.setFontSize(12);
  doc.text("AGENDA DE REUNIONES", 148, 23, { align: "center" });
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(`Generado el: ${formatearFechaHora(new Date())}`, 148, 30, { align: "center" });

  const head = [
    "Fecha carga",
    "Organismo / Institución",
    "Fecha reunión",
    "Hora",
    "Observación",
    "Contacto",
    "Estado",
    "Cargo",
    "Teléfono",
    "Mail",
  ];
  const body = reuniones.map((r) => [
    formatearFecha(r.fechaCarga),
    r.organismo,
    formatearFecha(r.fechaReunion),
    r.hora ?? "—",
    (r.observacion ?? "—").slice(0, 50) + ((r.observacion?.length ?? 0) > 50 ? "..." : ""),
    [r.contactoNombre, r.contactoApellido].filter(Boolean).join(" ") || "—",
    estadoLabel(r.estado),
    r.contactoCargo ?? "—",
    r.contactoTelefono ?? "—",
    r.contactoMail ?? "—",
  ]);

  autoTable(doc, {
    startY: 35,
    head: [head],
    body,
    styles: { fontSize: 8 },
    headStyles: { fillColor: [34, 197, 94] },
  });

  doc.save(`agenda_${formatearFechaArchivo(new Date())}.pdf`);
}

/** Exportar todas las reuniones a DOCX */
export async function exportarAgendaDOCX(reuniones: ReunionExport[]): Promise<void> {
  const rows = [
    new TableRow({
      children: [
        "Fecha carga",
        "Organismo",
        "Fecha reunión",
        "Hora",
        "Observación",
        "Contacto",
        "Estado",
        "Cargo",
        "Teléfono",
        "Mail",
      ].map(
        (text) =>
          new TableCell({
            children: [
              new Paragraph({
                children: [new TextRun({ text, bold: true })],
              }),
            ],
            width: { size: 10, type: WidthType.PERCENTAGE },
          })
      ),
      tableHeader: true,
    }),
    ...reuniones.map(
      (r) =>
        new TableRow({
          children: [
            formatearFecha(r.fechaCarga),
            r.organismo,
            formatearFecha(r.fechaReunion),
            r.hora ?? "—",
            (r.observacion ?? "—").slice(0, 80),
            [r.contactoNombre, r.contactoApellido].filter(Boolean).join(" ") || "—",
            estadoLabel(r.estado),
            r.contactoCargo ?? "—",
            r.contactoTelefono ?? "—",
            r.contactoMail ?? "—",
          ].map(
            (text) =>
              new TableCell({
                children: [new Paragraph({ text: String(text) })],
                width: { size: 10, type: WidthType.PERCENTAGE },
              })
          ),
        })
    ),
  ];

  const doc = new Document({
    sections: [
      {
        children: [
          new Paragraph({
            children: [
              new TextRun({
                text: "CONSEJO SUPERIOR - COLEGIO DE MÉDICOS",
                bold: true,
                size: 28,
              }),
            ],
            alignment: AlignmentType.CENTER,
          }),
          new Paragraph({
            children: [new TextRun({ text: "AGENDA DE REUNIONES", bold: true, size: 24 })],
            alignment: AlignmentType.CENTER,
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: `Generado el: ${formatearFechaHora(new Date())}`,
                size: 22,
              }),
            ],
            alignment: AlignmentType.CENTER,
          }),
          new Paragraph({ text: "" }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: {
              top: { style: BorderStyle.SINGLE },
              bottom: { style: BorderStyle.SINGLE },
              left: { style: BorderStyle.SINGLE },
              right: { style: BorderStyle.SINGLE },
            },
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
  a.download = `agenda_${formatearFechaArchivo(new Date())}.docx`;
  a.click();
  URL.revokeObjectURL(url);
}

/** Exportar una reunión a PDF */
export function exportarReunionPDF(reunion: ReunionExport): void {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("CONSEJO SUPERIOR - COLEGIO DE MÉDICOS", 105, 20, { align: "center" });
  doc.setFontSize(12);
  doc.text("REUNIÓN INSTITUCIONAL", 105, 30, { align: "center" });

  doc.line(14, 35, 196, 35);

  let y = 45;
  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");

  doc.setFont("helvetica", "bold");
  doc.text("Organismo / Institución:", 14, y);
  doc.setFont("helvetica", "normal");
  doc.text(reunion.organismo, 80, y);
  y += 10;

  doc.setFont("helvetica", "bold");
  doc.text("Fecha de la reunión:", 14, y);
  doc.setFont("helvetica", "normal");
  doc.text(formatearFecha(reunion.fechaReunion), 80, y);
  y += 10;

  doc.setFont("helvetica", "bold");
  doc.text("Estado:", 14, y);
  doc.setFont("helvetica", "normal");
  doc.text(estadoLabel(reunion.estado), 80, y);
  y += 10;

  if (reunion.hora) {
    doc.setFont("helvetica", "bold");
    doc.text("Hora:", 14, y);
    doc.setFont("helvetica", "normal");
    doc.text(reunion.hora, 80, y);
    y += 10;
  }

  if (reunion.observacion) {
    doc.setFont("helvetica", "bold");
    doc.text("Observación:", 14, y);
    y += 7;
    doc.setFont("helvetica", "normal");
    const lines = doc.splitTextToSize(reunion.observacion, 176);
    doc.text(lines, 14, y);
    y += lines.length * 7;
  }

  const tieneContacto =
    reunion.contactoNombre ||
    reunion.contactoApellido ||
    reunion.contactoCargo ||
    reunion.contactoTelefono ||
    reunion.contactoMail;
  if (tieneContacto) {
    y += 5;
    doc.line(14, y, 196, y);
    y += 8;
    doc.setFont("helvetica", "bold");
    doc.text("DATOS DE CONTACTO", 14, y);
    y += 10;
    doc.setFont("helvetica", "normal");

    if (reunion.contactoNombre || reunion.contactoApellido) {
      doc.text(
        `Nombre: ${[reunion.contactoNombre, reunion.contactoApellido].filter(Boolean).join(" ")}`,
        14,
        y
      );
      y += 8;
    }
    if (reunion.contactoCargo) {
      doc.text(`Cargo: ${reunion.contactoCargo}`, 14, y);
      y += 8;
    }
    if (reunion.contactoTelefono) {
      doc.text(`Teléfono: ${reunion.contactoTelefono}`, 14, y);
      y += 8;
    }
    if (reunion.contactoMail) {
      doc.text(`Mail: ${reunion.contactoMail}`, 14, y);
      y += 8;
    }
  }

  doc.setFontSize(9);
  doc.setTextColor(150, 150, 150);
  doc.text(`Generado el ${formatearFechaHora(new Date())}`, 105, 287, { align: "center" });

  doc.save(`reunion_${formatearFechaArchivo(reunion.fechaReunion)}.pdf`);
}

/** Exportar una reunión a DOCX */
export async function exportarReunionDOCX(reunion: ReunionExport): Promise<void> {
  const children: Paragraph[] = [
    new Paragraph({
      children: [
        new TextRun({
          text: "CONSEJO SUPERIOR - COLEGIO DE MÉDICOS",
          bold: true,
          size: 28,
        }),
      ],
      alignment: AlignmentType.CENTER,
    }),
    new Paragraph({
      children: [new TextRun({ text: "REUNIÓN INSTITUCIONAL", bold: true, size: 24 })],
      alignment: AlignmentType.CENTER,
    }),
    new Paragraph({ text: "" }),
    new Paragraph({
      children: [
        new TextRun({ text: "Organismo / Institución: ", bold: true }),
        new TextRun({ text: reunion.organismo }),
      ],
    }),
    new Paragraph({
      children: [
        new TextRun({ text: "Fecha de la reunión: ", bold: true }),
        new TextRun({ text: formatearFecha(reunion.fechaReunion) }),
      ],
    }),
    new Paragraph({
      children: [
        new TextRun({ text: "Estado: ", bold: true }),
        new TextRun({ text: estadoLabel(reunion.estado) }),
      ],
    }),
  ];

  if (reunion.hora) {
    children.push(
      new Paragraph({
        children: [
          new TextRun({ text: "Hora: ", bold: true }),
          new TextRun({ text: reunion.hora }),
        ],
      })
    );
  }
  if (reunion.observacion) {
    children.push(
      new Paragraph({
        children: [new TextRun({ text: "Observación: ", bold: true })],
      }),
      new Paragraph({ text: reunion.observacion })
    );
  }

  const tieneContacto =
    reunion.contactoNombre ||
    reunion.contactoApellido ||
    reunion.contactoCargo ||
    reunion.contactoTelefono ||
    reunion.contactoMail;
  if (tieneContacto) {
    children.push(new Paragraph({ text: "" }));
    children.push(
      new Paragraph({
        children: [new TextRun({ text: "DATOS DE CONTACTO", bold: true })],
      })
    );
    if (reunion.contactoNombre || reunion.contactoApellido) {
      children.push(
        new Paragraph({
          text: `Nombre: ${[reunion.contactoNombre, reunion.contactoApellido].filter(Boolean).join(" ")}`,
        })
      );
    }
    if (reunion.contactoCargo) {
      children.push(new Paragraph({ text: `Cargo: ${reunion.contactoCargo}` }));
    }
    if (reunion.contactoTelefono) {
      children.push(new Paragraph({ text: `Teléfono: ${reunion.contactoTelefono}` }));
    }
    if (reunion.contactoMail) {
      children.push(new Paragraph({ text: `Mail: ${reunion.contactoMail}` }));
    }
  }

  children.push(new Paragraph({ text: "" }));
  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: `Generado el ${formatearFechaHora(new Date())}`,
          size: 18,
          color: "888888",
        }),
      ],
      alignment: AlignmentType.CENTER,
    })
  );

  const doc = new Document({
    sections: [{ children }],
  });

  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `reunion_${formatearFechaArchivo(reunion.fechaReunion)}.docx`;
  a.click();
  URL.revokeObjectURL(url);
}
