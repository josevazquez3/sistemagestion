"use client";

import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";

type Props = {
  informe: {
    fechaDesde: Date;
    fechaHasta: Date;
  };
  ingresosDistrito: {
    distritoNumero: number;
    periodos: string;
    ctaColegImporte: number;
    nMatriculadosImporte: number;
  }[];
  totalIngresosA: number;
  cobroCertificaciones: { importe: number };
  totalIngresosB: number;
  totalGeneralIngresos: number;
  egresos: {
    numero?: string;
    concepto: string;
    importe: number;
  }[];
  totalEgresos: number;
  ultimosAportes: {
    distritoNumero: number;
    fechaMostrar: Date | null;
  }[];
  conciliacion: {
    saldoBancoRio: number;
    saldoFondoFijo: number;
    chequesADepositar: number;
    total: number;
  };
  compromisos: {
    numero?: string;
    concepto: string;
    importe: number;
  }[];
  totalCompromisos: number;
  saldoFinal: number;
  textBoxes: {
    numero: number;
    contenido: string;
  }[];
};

const COLS = 6;
const NUM_FMT = '"$" #,##0.00';

function formatoPeriodoLargo(desde: Date, hasta: Date): string {
  const dDia = desde.toLocaleDateString("es-AR", { day: "2-digit", timeZone: "UTC" });
  const hDia = hasta.toLocaleDateString("es-AR", { day: "2-digit", timeZone: "UTC" });
  const dMes = desde.toLocaleDateString("es-AR", { month: "long", timeZone: "UTC" });
  const hMes = hasta.toLocaleDateString("es-AR", { month: "long", timeZone: "UTC" });
  const hAnio = hasta.toLocaleDateString("es-AR", { year: "numeric", timeZone: "UTC" });
  return `${dDia} de ${dMes} al ${hDia} de ${hMes} ${hAnio}`;
}

function formatFechaDdMmYyyy(d: Date | null): string {
  if (!d) return "-";
  return d.toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  });
}

function romano(n: number): string {
  return (
    {
      1: "I",
      2: "II",
      3: "III",
      4: "IV",
      5: "V",
      6: "VI",
      7: "VII",
      8: "VIII",
      9: "IX",
      10: "X",
    }[n] ?? String(n)
  );
}

function addRow(aoa: (string | number)[][], ...cells: (string | number)[]) {
  const row = Array(COLS).fill("");
  for (let i = 0; i < Math.min(COLS, cells.length); i++) row[i] = cells[i] ?? "";
  aoa.push(row);
}

function setStyle(ws: XLSX.WorkSheet, r: number, c: number, style: Record<string, unknown>) {
  const addr = XLSX.utils.encode_cell({ r, c });
  const cell = ws[addr];
  if (!cell) return;
  (cell as { s?: Record<string, unknown> }).s = {
    ...((cell as { s?: Record<string, unknown> }).s ?? {}),
    ...style,
  };
}

function applyRowStyle(ws: XLSX.WorkSheet, r: number, style: Record<string, unknown>, fromC = 0, toC = COLS - 1) {
  for (let c = fromC; c <= toC; c++) setStyle(ws, r, c, style);
}

function splitIndicador(texto: string): { prefijo: string; cuerpo: string } {
  const t = (texto ?? "").trim();
  const m = /^(\d+\)\))\s*(.*)$/.exec(t);
  if (!m) return { prefijo: "", cuerpo: t };
  return { prefijo: m[1] ?? "", cuerpo: m[2] ?? "" };
}

function setNumeric(ws: XLSX.WorkSheet, r: number, c: number, fmt = NUM_FMT) {
  const addr = XLSX.utils.encode_cell({ r, c });
  const cell = ws[addr] as XLSX.CellObject | undefined;
  if (!cell) return;
  cell.t = "n";
  cell.z = fmt;
}

export function ExportarExcelButton(props: Props) {
  const onExport = () => {
    const aoa: (string | number)[][] = [];
    const merges: XLSX.Range[] = [];
    const boldRows = new Set<number>();
    const totalRows = new Set<number>();
    const romanRows: number[] = [];
    const wrapRows: number[] = [];

    addRow(
      aoa,
      `REUNION CONSEJO SUPERIOR  ${props.informe.fechaHasta.toLocaleDateString("es-AR", {
        day: "2-digit",
        month: "long",
        year: "numeric",
        timeZone: "UTC",
      })}`,
      "",
      "",
      "",
      "",
      ""
    );
    merges.push({ s: { r: 0, c: 0 }, e: { r: 0, c: 5 } });

    addRow(aoa, "INFORME DE TESORERIA", "", "", "", "", "");
    merges.push({ s: { r: 1, c: 0 }, e: { r: 1, c: 5 } });

    addRow(aoa, "", "", "", "", "", "");

    addRow(aoa, `Periodo: del ${formatoPeriodoLargo(props.informe.fechaDesde, props.informe.fechaHasta)}`, "", "", "", "", "");
    merges.push({ s: { r: 3, c: 0 }, e: { r: 3, c: 5 } });
    boldRows.add(3);

    addRow(aoa, "A) INGRESOS.", "", "", "", "", "");
    boldRows.add(4);

    addRow(aoa, "", "DIST.", "CONCEPTO", "", "", "IMPORTE");
    merges.push({ s: { r: 5, c: 2 }, e: { r: 5, c: 4 } });
    boldRows.add(5);

    for (const d of props.ingresosDistrito) {
      const r1 = aoa.length;
      addRow(aoa, "", romano(d.distritoNumero), `Cta. Coleg.${d.periodos ? ` ${d.periodos}` : ""}`, "", "", d.ctaColegImporte);
      merges.push({ s: { r: r1, c: 2 }, e: { r: r1, c: 4 } });
      romanRows.push(r1);

      const r2 = aoa.length;
      addRow(aoa, "", "", "Nuevos matriculados", "", "", d.nMatriculadosImporte);
      merges.push({ s: { r: r2, c: 2 }, e: { r: r2, c: 4 } });
    }

    const totalARow = aoa.length;
    addRow(aoa, "", "TOTAL", "", "", "", props.totalIngresosA);
    totalRows.add(totalARow);
    addRow(aoa, "", "", "", "", "", "");

    const secBRow = aoa.length;
    addRow(aoa, "B) INGRESOS.", "", "", "", "", "");
    boldRows.add(secBRow);

    const bHeader = aoa.length;
    addRow(aoa, "", "CONCEPTO", "", "", "", "IMPORTE");
    merges.push({ s: { r: bHeader, c: 1 }, e: { r: bHeader, c: 4 } });
    boldRows.add(bHeader);

    const bData = aoa.length;
    addRow(aoa, "", "COBRO CERTIFICACIONES", "", "", "", props.cobroCertificaciones.importe);
    merges.push({ s: { r: bData, c: 1 }, e: { r: bData, c: 4 } });

    const totalBRow = aoa.length;
    addRow(aoa, "", "TOTAL", "", "", "", props.totalIngresosB);
    totalRows.add(totalBRow);

    const totalGeneralRow = aoa.length;
    addRow(aoa, "", "TOTAL GENERAL INGRESO........................................................", "", "", "", props.totalGeneralIngresos);
    merges.push({ s: { r: totalGeneralRow, c: 1 }, e: { r: totalGeneralRow, c: 4 } });
    totalRows.add(totalGeneralRow);
    addRow(aoa, "", "", "", "", "", "");

    const secCRow = aoa.length;
    addRow(aoa, "C) EGRESOS.", "", "", "", "", "");
    boldRows.add(secCRow);

    const cHeader = aoa.length;
    addRow(aoa, "", "CONCEPTO", "", "", "", "IMPORTE");
    merges.push({ s: { r: cHeader, c: 1 }, e: { r: cHeader, c: 4 } });
    boldRows.add(cHeader);

    const egresosStart = aoa.length;
    for (const e of props.egresos) {
      const { prefijo, cuerpo } = splitIndicador(e.concepto);
      const r = aoa.length;
      addRow(aoa, prefijo, cuerpo, "", "", "", Math.abs(e.importe));
      merges.push({ s: { r, c: 1 }, e: { r, c: 4 } });
      if (prefijo) boldRows.add(r);
    }
    const egresosEnd = aoa.length - 1;

    const totalCRow = aoa.length;
    addRow(aoa, "", "TOTAL............................................................", "", "", "", 0);
    merges.push({ s: { r: totalCRow, c: 1 }, e: { r: totalCRow, c: 4 } });
    totalRows.add(totalCRow);
    addRow(aoa, "", "", "", "", "", "");

    const uaTitle1 = aoa.length;
    addRow(aoa, "ULTIMOS APORTES DISTRITALES EN CONCEPTO DE", "", "", "", "", "");
    merges.push({ s: { r: uaTitle1, c: 0 }, e: { r: uaTitle1, c: 5 } });
    boldRows.add(uaTitle1);

    const uaTitle2 = aoa.length;
    addRow(aoa, "NUEVOS MATRICULADOS Y GS. ADMINISTRATIVOS", "", "", "", "", "");
    merges.push({ s: { r: uaTitle2, c: 0 }, e: { r: uaTitle2, c: 5 } });
    boldRows.add(uaTitle2);

    addRow(aoa, "", "", "", "", "", "");

    const uaStart = aoa.length;
    for (let i = 0; i < 5; i++) {
      const leftDist = i + 1;
      const rightDist = i + 6;
      const left = props.ultimosAportes.find((x) => x.distritoNumero === leftDist);
      const right = props.ultimosAportes.find((x) => x.distritoNumero === rightDist);
      const r = aoa.length;
      addRow(
        aoa,
        "",
        `Distrito ${romano(leftDist)}`,
        formatFechaDdMmYyyy(left?.fechaMostrar ?? null),
        `Distrito ${romano(rightDist)}`,
        formatFechaDdMmYyyy(right?.fechaMostrar ?? null),
        ""
      );
      boldRows.add(r);
    }
    addRow(aoa, "", "", "", "", "", "");

    const concTitle = aoa.length;
    addRow(aoa, "CONCILIACION FINANCIERA PROYECTADA", "", "", "", "", "");
    merges.push({ s: { r: concTitle, c: 0 }, e: { r: concTitle, c: 5 } });
    boldRows.add(concTitle);

    addRow(aoa, "", "", "", "", "", "");

    const concPeriod = aoa.length;
    addRow(aoa, `Periodo: del ${formatoPeriodoLargo(props.informe.fechaDesde, props.informe.fechaHasta)}`, "", "", "", "", "");
    merges.push({ s: { r: concPeriod, c: 0 }, e: { r: concPeriod, c: 5 } });
    boldRows.add(concPeriod);

    addRow(aoa, "", "", "", "", "", "");

    const concI = aoa.length;
    addRow(aoa, "I)", "SALDO Banco Rio Cta. Cte........................................................", "", "", "", props.conciliacion.saldoBancoRio);
    merges.push({ s: { r: concI, c: 1 }, e: { r: concI, c: 4 } });
    boldRows.add(concI);

    const concII = aoa.length;
    addRow(aoa, "II)", "SALDO Fondo Fijo...............................................................", "", "", "", props.conciliacion.saldoFondoFijo);
    merges.push({ s: { r: concII, c: 1 }, e: { r: concII, c: 4 } });
    boldRows.add(concII);

    const concIII = aoa.length;
    addRow(aoa, "III)", "Cheques a depositar............................................................", "", "", "", props.conciliacion.chequesADepositar);
    merges.push({ s: { r: concIII, c: 1 }, e: { r: concIII, c: 4 } });
    boldRows.add(concIII);

    const concTotal = aoa.length;
    addRow(aoa, "", "TOTAL:", "..............", "................................", "", 0);
    merges.push({ s: { r: concTotal, c: 3 }, e: { r: concTotal, c: 4 } });
    totalRows.add(concTotal);

    addRow(aoa, "", "", "", "", "", "");

    const compHeader = aoa.length;
    addRow(aoa, "IV)", "COMPROMISOS A PAGAR: ..........................................................", "", "", "", 0);
    merges.push({ s: { r: compHeader, c: 1 }, e: { r: compHeader, c: 4 } });
    totalRows.add(compHeader);

    const compStart = aoa.length;
    for (const c of props.compromisos) {
      const { prefijo, cuerpo } = splitIndicador(c.concepto);
      const r = aoa.length;
      addRow(aoa, prefijo || (c.numero ?? ""), cuerpo, "", "", "", c.importe);
      merges.push({ s: { r, c: 1 }, e: { r, c: 4 } });
      if (prefijo) boldRows.add(r);
    }
    const compEnd = aoa.length - 1;

    addRow(aoa, "", "", "", "", "", "");

    const saldoRow = aoa.length;
    addRow(aoa, "", "SALDO......................................................................", "", "", "", 0);
    merges.push({ s: { r: saldoRow, c: 1 }, e: { r: saldoRow, c: 4 } });
    totalRows.add(saldoRow);

    addRow(aoa, "", "", "", "", "", "");

    for (const t of props.textBoxes) {
      const r = aoa.length;
      addRow(aoa, "", `${t.numero})) ${t.contenido}`, "", "", "", "");
      merges.push({ s: { r, c: 1 }, e: { r, c: 5 } });
      wrapRows.push(r);
    }

    const borderRanges: Array<{ fromR: number; toR: number; fromC: number; toC: number }> = [
      { fromR: 5, toR: totalARow, fromC: 1, toC: 5 }, // A) tabla
      { fromR: bHeader, toR: totalGeneralRow, fromC: 1, toC: 5 }, // B) tabla
      { fromR: cHeader, toR: totalCRow, fromC: 1, toC: 5 }, // C) tabla
      { fromR: uaStart, toR: uaStart + 4, fromC: 1, toC: 4 }, // ultimos aportes
      { fromR: concI, toR: saldoRow, fromC: 0, toC: 5 }, // conciliacion + compromisos + saldo
    ];
    if (wrapRows.length > 0) {
      borderRanges.push({ fromR: wrapRows[0], toR: wrapRows[wrapRows.length - 1], fromC: 1, toC: 5 });
    }

    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws["!merges"] = merges;
    ws["!cols"] = [
      { wch: 5.42 },
      { wch: 11.71 },
      { wch: 12.14 },
      { wch: 14.71 },
      { wch: 17.86 },
      { wch: 18.0 },
    ];
    ws["!rows"] = aoa.map((_, idx) => {
      if (idx === 0) return { hpt: 27 };
      if (idx === 1) return { hpt: 23.25 };
      if (idx === 3) return { hpt: 15.75 };
      if (idx >= 6 && idx <= totalARow - 1) return { hpt: 13.5 }; // filas detalle A
      return { hpt: 15.75 };
    });

    const baseFont = { font: { name: "Calibri", sz: 12, color: { rgb: "000000" } } };
    const bold = { font: { name: "Calibri", sz: 12, bold: true, color: { rgb: "000000" } } };
    const centered = { alignment: { horizontal: "center", vertical: "center" } };
    const right = { alignment: { horizontal: "right", vertical: "center" } };
    const border = {
      border: {
        top: { style: "thin", color: { rgb: "000000" } },
        right: { style: "thin", color: { rgb: "000000" } },
        bottom: { style: "thin", color: { rgb: "000000" } },
        left: { style: "thin", color: { rgb: "000000" } },
      },
    };

    for (let r = 0; r < aoa.length; r++) {
      for (let c = 0; c < COLS; c++) {
        setStyle(ws, r, c, baseFont);
      }
    }

    applyRowStyle(ws, 0, { font: { name: "Comic Sans MS", sz: 12 }, alignment: { horizontal: "center" } });
    applyRowStyle(ws, 1, { font: { name: "Comic Sans MS", sz: 12 }, alignment: { horizontal: "center" } });
    applyRowStyle(ws, 3, { ...bold, ...centered });

    for (const r of boldRows) applyRowStyle(ws, r, bold);
    for (const r of totalRows) applyRowStyle(ws, r, bold);
    for (const r of romanRows) setStyle(ws, r, 1, { ...bold, alignment: { horizontal: "center", vertical: "center" } });

    for (const rg of borderRanges) {
      for (let r = rg.fromR; r <= rg.toR; r++) {
        applyRowStyle(ws, r, border, rg.fromC, rg.toC);
      }
    }
    for (let r = 0; r < aoa.length; r++) {
      setStyle(ws, r, 5, right);
      setStyle(ws, r, 1, { alignment: { horizontal: "center", vertical: "center" } });
      setStyle(ws, r, 2, centered);
      setStyle(ws, r, 3, centered);
      setStyle(ws, r, 4, centered);
    }

    // Microajuste final: textos largos en C) Egresos y Compromisos alineados a la izquierda.
    for (let r = egresosStart; r <= egresosEnd; r++) {
      setStyle(ws, r, 1, { alignment: { horizontal: "left", vertical: "center" } });
    }
    setStyle(ws, totalCRow, 1, { alignment: { horizontal: "left", vertical: "center" } });
    setStyle(ws, compHeader, 1, { alignment: { horizontal: "left", vertical: "center" } });
    for (let r = compStart; r <= compEnd; r++) {
      setStyle(ws, r, 1, { alignment: { horizontal: "left", vertical: "center" } });
    }
    setStyle(ws, saldoRow, 1, { alignment: { horizontal: "left", vertical: "center" } });

    for (let r = uaStart; r < uaStart + 5; r++) {
      setStyle(ws, r, 1, { ...bold, alignment: { horizontal: "left", vertical: "center" } });
      setStyle(ws, r, 3, { ...bold, alignment: { horizontal: "left", vertical: "center" } });
      setStyle(ws, r, 2, centered);
      setStyle(ws, r, 4, centered);
    }

    if (egresosStart <= egresosEnd) {
      const cell = ws[XLSX.utils.encode_cell({ r: totalCRow, c: 5 })] as XLSX.CellObject;
      cell.f = `SUM(F${egresosStart + 1}:F${egresosEnd + 1})`;
    }
    (ws[XLSX.utils.encode_cell({ r: concTotal, c: 5 })] as XLSX.CellObject).f = `SUM(F${concI + 1}:F${concIII + 1})`;
    if (compStart <= compEnd) {
      (ws[XLSX.utils.encode_cell({ r: compHeader, c: 5 })] as XLSX.CellObject).f = `SUM(F${compStart + 1}:F${compEnd + 1})`;
    }
    (ws[XLSX.utils.encode_cell({ r: saldoRow, c: 5 })] as XLSX.CellObject).f = `F${concTotal + 1}-F${compHeader + 1}`;

    for (let r = 0; r < aoa.length; r++) {
      for (let c = 0; c < COLS; c++) {
        if (typeof aoa[r][c] === "number") setNumeric(ws, r, c);
      }
    }
    setNumeric(ws, totalCRow, 5);
    setNumeric(ws, concTotal, 5);
    setNumeric(ws, compHeader, 5);
    setNumeric(ws, saldoRow, 5);

    for (const r of wrapRows) {
      setStyle(ws, r, 1, { alignment: { horizontal: "left", vertical: "top", wrapText: true } });
      const txt = String(aoa[r][1] ?? "");
      ws["!rows"]![r] = { hpt: txt.length > 120 ? 54 : txt.length > 90 ? 49 : 39 };
    }

    setStyle(ws, 0, 0, { font: { name: "Comic Sans MS", sz: 12, underline: true } });
    setStyle(ws, 1, 0, { font: { name: "Comic Sans MS", sz: 12, underline: true } });

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Informe");
    const filename = `Informe_Tesoreria_${props.informe.fechaDesde.toISOString().slice(0, 10)}.xlsx`;
    XLSX.writeFile(wb, filename);
  };

  return (
    <Button type="button" variant="outline" onClick={onExport}>
      <Download className="w-4 h-4 mr-2" />
      Exportar Excel
    </Button>
  );
}
