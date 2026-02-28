/**
 * Exportación de auditoría a PDF y DOCX en el cliente (browser).
 * Formato de fecha: DD/MM/YYYY HH:mm:ss (Argentina).
 */

export type LogAuditoria = {
  id?: number;
  creadoEn: string;
  userNombre: string;
  userEmail: string;
  modulo: string;
  accion: string;
  detalle: string | null;
};

export type OpcionesExportacion = {
  nombreSistema: string;
  periodoDesde?: string;
  periodoHasta?: string;
  usuarioNombre: string;
  fechaGeneracion: string;
};

function formatearFechaArgentina(iso: string): string {
  const d = new Date(iso);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  const h = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  const s = String(d.getSeconds()).padStart(2, "0");
  return `${day}/${month}/${year} ${h}:${min}:${s}`;
}

export async function exportarPDF(
  logs: LogAuditoria[],
  opciones: OpcionesExportacion
): Promise<Blob> {
  const { jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const margin = 14;
  let y = 20;

  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text(opciones.nombreSistema, margin, y);
  y += 8;

  doc.setFontSize(12);
  doc.text("Historial de Auditoría del Sistema", margin, y);
  y += 8;

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  const periodo =
    opciones.periodoDesde != null || opciones.periodoHasta != null
      ? `Período: ${opciones.periodoDesde ?? "—"} - ${opciones.periodoHasta ?? "—"}`
      : "Todos los registros";
  doc.text(periodo, margin, y);
  y += 6;
  doc.text(`Usuario: ${opciones.usuarioNombre}`, margin, y);
  y += 6;
  doc.text(`Fecha de generación: ${opciones.fechaGeneracion}`, margin, y);
  y += 10;

  const head = [["Fecha y hora", "Usuario", "Módulo", "Acción", "Detalle"]];
  const body = logs.map((l) => [
    formatearFechaArgentina(l.creadoEn),
    l.userNombre,
    l.modulo,
    l.accion,
    l.detalle ?? "",
  ]);

  autoTable(doc, {
    head,
    body,
    startY: y,
    margin: { left: margin, right: margin },
    theme: "grid",
    headStyles: { fontStyle: "bold", fontSize: 9 },
    bodyStyles: { fontSize: 8 },
    columnStyles: {
      0: { cellWidth: 32 },
      1: { cellWidth: 35 },
      2: { cellWidth: 28 },
      3: { cellWidth: 40 },
      4: { cellWidth: "auto" },
    },
  });

  return doc.output("blob");
}

export async function exportarDOCX(
  logs: LogAuditoria[],
  opciones: OpcionesExportacion
): Promise<Blob> {
  const {
    Document,
    Packer,
    Paragraph,
    TextRun,
    Table,
    TableRow,
    TableCell,
    WidthType,
    BorderStyle,
    AlignmentType,
  } = await import("docx");

  const font = "Arial";
  const size = 22; // 11pt half-points

  type ParagraphOrTable = InstanceType<typeof Paragraph> | InstanceType<typeof Table>;
  const children: ParagraphOrTable[] = [
    new Paragraph({
      children: [
        new TextRun({ text: opciones.nombreSistema, font, size: 28, bold: true }),
      ],
      spacing: { after: 200 },
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: "Historial de Auditoría del Sistema",
          font,
          size,
          bold: true,
        }),
      ],
      spacing: { after: 100 },
    }),
    new Paragraph({
      children: [
        new TextRun({
          text:
            opciones.periodoDesde != null || opciones.periodoHasta != null
              ? `Período: ${opciones.periodoDesde ?? "—"} - ${opciones.periodoHasta ?? "—"}`
              : "Todos los registros",
          font,
          size,
        }),
      ],
      spacing: { after: 80 },
    }),
    new Paragraph({
      children: [
        new TextRun({ text: `Usuario: ${opciones.usuarioNombre}`, font, size }),
      ],
      spacing: { after: 80 },
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: `Fecha de generación: ${opciones.fechaGeneracion}`,
          font,
          size,
        }),
      ],
      spacing: { after: 200 },
    }),
  ];

  const tableRows = [
    new TableRow({
      children: [
        "Fecha y hora",
        "Usuario",
        "Módulo",
        "Acción",
        "Detalle",
      ].map(
        (t) =>
          new TableCell({
            children: [
              new Paragraph({
                children: [new TextRun({ text: t, font, size, bold: true })],
                alignment: AlignmentType.CENTER,
              }),
            ],
            shading: { fill: "E5E7EB" },
            borders: {
              top: { style: BorderStyle.SINGLE },
              bottom: { style: BorderStyle.SINGLE },
              left: { style: BorderStyle.SINGLE },
              right: { style: BorderStyle.SINGLE },
            },
          })
      ),
      tableHeader: true,
    }),
    ...logs.map(
      (l) =>
        new TableRow({
          children: [
            formatearFechaArgentina(l.creadoEn),
            l.userNombre,
            l.modulo,
            l.accion,
            l.detalle ?? "",
          ].map(
            (t) =>
              new TableCell({
                children: [
                  new Paragraph({
                    children: [new TextRun({ text: String(t).slice(0, 200), font, size })],
                  }),
                ],
                borders: {
                  top: { style: BorderStyle.SINGLE },
                  bottom: { style: BorderStyle.SINGLE },
                  left: { style: BorderStyle.SINGLE },
                  right: { style: BorderStyle.SINGLE },
                },
              })
          ),
        })
    ),
  ];

  const table = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: tableRows,
  });

  children.push(table);

  const doc = new Document({
    sections: [{ children }],
  });

  return await Packer.toBlob(doc);
}

export function descargarBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
