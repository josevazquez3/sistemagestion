import type { FilaConciliacion, ResumenConciliacion } from "@/types/conciliacion";

const MESES = [
  "",
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

const fmt = (n: number) =>
  new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 2,
  }).format(n);

export async function exportarConciliacionExcel(
  filas: FilaConciliacion[],
  resumen: ResumenConciliacion,
  mes: number,
  anio: number
) {
  const XLSX = await import("xlsx");

  const datos: (string | number)[][] = [
    ["Fecha", "Concepto", "Cuenta", "Tipo", "Ingreso", "Salida / Gasto"],
    ["", "Saldo Anterior", "", "", fmt(resumen.saldoAnterior), ""],
    ...filas.map((f) => [
      new Date(f.fecha).toLocaleDateString("es-AR"),
      f.concepto,
      `${f.cuentaCodigo} – ${f.cuentaNombre}`,
      f.tipo,
      f.tipo === "INGRESO" ? fmt(Math.abs(f.monto)) : "",
      f.tipo !== "INGRESO" ? fmt(Math.abs(f.monto)) : "",
    ]),
    [],
    ["", "", "", "", "Total Ingresos", fmt(resumen.totalIngresos)],
    ["", "", "", "", "Subtotal", fmt(resumen.subtotal)],
    ["", "", "", "", "Total Salidas", fmt(resumen.totalSalidas)],
    ["", "", "", "", "Total Gastos", fmt(resumen.totalGastos)],
    ["", "", "", "", "TOTAL CONCILIADO", fmt(resumen.totalConciliado)],
  ];

  const ws = XLSX.utils.aoa_to_sheet(datos);
  ws["!cols"] = [{ wch: 12 }, { wch: 55 }, { wch: 28 }, { wch: 10 }, { wch: 18 }, { wch: 18 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Conciliación");

  XLSX.writeFile(wb, `conciliacion_banco_${mes}_${anio}.xlsx`);
}

export async function exportarConciliacionPdf(
  filas: FilaConciliacion[],
  resumen: ResumenConciliacion,
  mes: number,
  anio: number
) {
  const { jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;

  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const titulo = `Conciliación Banco — ${MESES[mes]} ${anio}`;

  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text(titulo, 14, 16);

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(`Generado el ${new Date().toLocaleDateString("es-AR")}`, 14, 22);

  const filasSaldoAnterior = [
    ["", "Saldo Anterior", "", "", fmt(resumen.saldoAnterior), ""],
  ];

  const filasMovimientos = filas.map((f) => [
    new Date(f.fecha).toLocaleDateString("es-AR"),
    f.concepto,
    `${f.cuentaCodigo} – ${f.cuentaNombre}`,
    f.tipo,
    f.tipo === "INGRESO" ? fmt(Math.abs(f.monto)) : "",
    f.tipo !== "INGRESO" ? fmt(Math.abs(f.monto)) : "",
  ]);

  autoTable(doc, {
    startY: 28,
    head: [["Fecha", "Concepto", "Cuenta", "Tipo", "Ingreso", "Salida / Gasto"]],
    body: [...filasSaldoAnterior, ...filasMovimientos],
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [16, 185, 129], textColor: 255, fontStyle: "bold" },
    columnStyles: {
      0: { cellWidth: 22 },
      1: { cellWidth: 90 },
      2: { cellWidth: 55 },
      3: { cellWidth: 18 },
      4: { cellWidth: 28, halign: "right" },
      5: { cellWidth: 28, halign: "right" },
    },
    alternateRowStyles: { fillColor: [249, 250, 251] },
    didParseCell: (data) => {
      if (data.row.index === 0) {
        data.cell.styles.fillColor = [219, 234, 254];
        data.cell.styles.textColor = [29, 78, 216];
        data.cell.styles.fontStyle = "bold";
      }
    },
  });

  const finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;

  autoTable(doc, {
    startY: finalY,
    head: [["Concepto", "Importe"]],
    body: [
      ["Saldo Anterior", fmt(resumen.saldoAnterior)],
      ["Total Ingresos", fmt(resumen.totalIngresos)],
      ["Subtotal", fmt(resumen.subtotal)],
      ["Total Salidas", fmt(resumen.totalSalidas)],
      ["Total Gastos", fmt(resumen.totalGastos)],
      ["TOTAL CONCILIADO", fmt(resumen.totalConciliado)],
    ],
    styles: { fontSize: 9 },
    headStyles: { fillColor: [55, 65, 81], textColor: 255 },
    columnStyles: {
      0: { cellWidth: 60 },
      1: { cellWidth: 40, halign: "right" },
    },
    didParseCell: (data) => {
      if (data.row.index === 5) {
        data.cell.styles.fillColor = [209, 250, 229];
        data.cell.styles.textColor = [4, 120, 87];
        data.cell.styles.fontStyle = "bold";
      }
    },
  });

  doc.save(`conciliacion_banco_${mes}_${anio}.pdf`);
}
