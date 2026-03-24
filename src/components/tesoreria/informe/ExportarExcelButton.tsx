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

const COLS = 4;
const CURRENCY_FMT = '"$" #,##0.00;[Red]-"$" #,##0.00;"-"';

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

function setStyle(
  ws: XLSX.WorkSheet,
  r: number,
  c: number,
  style: Record<string, unknown>
) {
  const addr = XLSX.utils.encode_cell({ r, c });
  const cell = ws[addr];
  if (!cell) return;
  (cell as { s?: Record<string, unknown> }).s = {
    ...((cell as { s?: Record<string, unknown> }).s ?? {}),
    ...style,
  };
}

function applyRowStyle(
  ws: XLSX.WorkSheet,
  r: number,
  style: Record<string, unknown>,
  fromC = 0,
  toC = COLS - 1
) {
  for (let c = fromC; c <= toC; c++) setStyle(ws, r, c, style);
}

export function ExportarExcelButton(props: Props) {
  const onExport = () => {
    const aoa: (string | number)[][] = [];
    const merges: XLSX.Range[] = [];
    const sectionRows: number[] = [];
    const headerRows: number[] = [];
    const totalRows: number[] = [];
    let firstTextBoxRow = -1;

    addRow(aoa, "INFORME DE TESORERÍA", "", "", "");
    merges.push({ s: { r: 0, c: 0 }, e: { r: 0, c: 3 } });
    addRow(aoa, "", "", "", "");
    addRow(aoa, `Período: del ${formatoPeriodoLargo(props.informe.fechaDesde, props.informe.fechaHasta)}`, "", "", "");
    merges.push({ s: { r: 2, c: 0 }, e: { r: 2, c: 3 } });
    addRow(aoa, "", "", "", "");

    sectionRows.push(aoa.length);
    addRow(aoa, "A) INGRESOS.", "", "", "");
    headerRows.push(aoa.length);
    addRow(aoa, "DIST.", "CONCEPTO", "", "IMPORTE");
    for (const d of props.ingresosDistrito) {
      addRow(
        aoa,
        romano(d.distritoNumero),
        `Cta. Colegiacion${d.periodos ? ` ${d.periodos}` : ""}`,
        "",
        d.ctaColegImporte
      );
      addRow(
        aoa,
        "",
        "Nuevos matriculados",
        "",
        d.nMatriculadosImporte > 0 ? d.nMatriculadosImporte : "-"
      );
    }
    totalRows.push(aoa.length);
    addRow(aoa, "TOTAL", "", "", props.totalIngresosA);
    addRow(aoa, "", "", "", "");

    sectionRows.push(aoa.length);
    addRow(aoa, "B) INGRESOS.", "", "", "");
    headerRows.push(aoa.length);
    addRow(aoa, "CONCEPTO", "", "", "IMPORTE");
    addRow(aoa, "COBRO CERTIFICACIONES", "", "", props.cobroCertificaciones.importe);
    totalRows.push(aoa.length);
    addRow(aoa, "TOTAL", "", "", props.totalIngresosB);
    totalRows.push(aoa.length);
    addRow(aoa, "TOTAL GENERAL INGRESO", "", "", props.totalGeneralIngresos);
    addRow(aoa, "", "", "", "");

    sectionRows.push(aoa.length);
    addRow(aoa, "C) EGRESOS.", "", "", "");
    headerRows.push(aoa.length);
    addRow(aoa, "N°", "CONCEPTO", "", "IMPORTE");
    for (const e of props.egresos) {
      addRow(aoa, e.numero ?? "", e.concepto, "", Math.abs(e.importe));
    }
    totalRows.push(aoa.length);
    addRow(aoa, "TOTAL", "", "", Math.abs(props.totalEgresos));
    addRow(aoa, "", "", "", "");
    addRow(aoa, "", "", "", "");
    addRow(aoa, "", "", "", "");

    const uaTitleRow = aoa.length;
    addRow(
      aoa,
      "ÚLTIMOS APORTES DISTRITALES EN CONCEPTO DE NUEVOS MATRICULADOS Y GS. ADMINISTRATIVOS",
      "",
      "",
      ""
    );
    merges.push({ s: { r: uaTitleRow, c: 0 }, e: { r: uaTitleRow, c: 3 } });
    addRow(aoa, "", "", "", "");
    const uaGridStartRow = aoa.length;
    for (let i = 0; i < 5; i++) {
      const leftDist = i + 1;
      const rightDist = i + 6;
      const left = props.ultimosAportes.find((x) => x.distritoNumero === leftDist);
      const right = props.ultimosAportes.find((x) => x.distritoNumero === rightDist);
      addRow(
        aoa,
        `Distrito ${romano(leftDist)}`,
        formatFechaDdMmYyyy(left?.fechaMostrar ?? null),
        `Distrito ${romano(rightDist)}`,
        formatFechaDdMmYyyy(right?.fechaMostrar ?? null)
      );
    }
    addRow(aoa, "", "", "", "");

    const concTitleRow = aoa.length;
    sectionRows.push(concTitleRow);
    addRow(aoa, "CONCILIACIÓN FINANCIERA PROYECTADA", "", "", "");
    merges.push({ s: { r: concTitleRow, c: 0 }, e: { r: concTitleRow, c: 3 } });
    addRow(aoa, "", "", "", "");
    const concPeriodRow = aoa.length;
    addRow(aoa, `Período: del ${formatoPeriodoLargo(props.informe.fechaDesde, props.informe.fechaHasta)}`, "", "", "");
    merges.push({ s: { r: concPeriodRow, c: 0 }, e: { r: concPeriodRow, c: 3 } });
    addRow(aoa, "", "", "", "");
    addRow(aoa, "I)", "SALDO Banco Rio Cta. Cte......................", "$", props.conciliacion.saldoBancoRio);
    addRow(aoa, "", "", "", "");
    addRow(aoa, "II)", "SALDO Fondo Fijo............................", "$", props.conciliacion.saldoFondoFijo);
    addRow(aoa, "", "", "", "");
    addRow(aoa, "III)", "Cheques a depositar........................", "$", props.conciliacion.chequesADepositar);
    totalRows.push(aoa.length);
    addRow(aoa, "", "TOTAL:", "$", props.conciliacion.total);
    addRow(aoa, "", "", "", "");

    const compromisosHeaderRow = aoa.length;
    totalRows.push(compromisosHeaderRow);
    addRow(aoa, "IV)", "COMPROMISOS A PAGAR:.......................", "$", props.totalCompromisos);
    for (const c of props.compromisos) {
      addRow(aoa, c.numero ?? "", c.concepto, c.importe, "");
    }
    addRow(aoa, "", "", "", "");
    const saldoRowExpected = aoa.length;
    totalRows.push(saldoRowExpected);
    addRow(aoa, "SALDO", ".......................................", "$", props.saldoFinal);
    addRow(aoa, "", "", "", "");
    addRow(aoa, "", "", "", "");

    for (const t of props.textBoxes) {
      const row = aoa.length;
      if (firstTextBoxRow < 0) firstTextBoxRow = row;
      addRow(aoa, `${t.numero})) ${t.contenido}`, "", "", "");
      merges.push({ s: { r: row, c: 0 }, e: { r: row, c: 3 } });
    }

    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws["!merges"] = merges;
    ws["!cols"] = [{ wch: 7 }, { wch: 52 }, { wch: 24 }, { wch: 18 }];
    ws["!rows"] = aoa.map((_, idx) => ({
      hpt: idx === 0 ? 28 : idx === 2 ? 20 : 17,
    }));

    const baseFont = { font: { name: "Calibri", sz: 11, color: { rgb: "000000" } } };
    const bold = { font: { name: "Calibri", sz: 11, bold: true, color: { rgb: "000000" } } };
    const centered = { alignment: { horizontal: "center", vertical: "center" } };
    const right = { alignment: { horizontal: "right" } };
    const gray = { fill: { patternType: "solid", fgColor: { rgb: "FFFFFF" } } };
    const underline = { font: { name: "Calibri", sz: 11, bold: true, underline: true } };
    const borderAll = {
      border: {
        top: { style: "thin", color: { rgb: "000000" } },
        right: { style: "thin", color: { rgb: "000000" } },
        bottom: { style: "thin", color: { rgb: "000000" } },
        left: { style: "thin", color: { rgb: "000000" } },
      },
    };
    const borderTopStrong = {
      border: {
        top: { style: "medium", color: { rgb: "7F7F7F" } },
      },
    };
    const titleStyle = {
      font: { name: "Calibri", sz: 17, bold: true, underline: true, color: { rgb: "000000" } },
      alignment: { horizontal: "center", vertical: "center" },
    };
    const subtitleStyle = {
      font: { name: "Calibri", sz: 12, bold: true, color: { rgb: "000000" } },
      alignment: { horizontal: "center", vertical: "center" },
    };

    for (let r = 0; r < aoa.length; r++) {
      for (let c = 0; c < COLS; c++) {
        setStyle(ws, r, c, baseFont);
      }
    }

    applyRowStyle(ws, 0, titleStyle);
    applyRowStyle(ws, 2, subtitleStyle);

    for (const r of sectionRows) applyRowStyle(ws, r, bold);
    for (const r of headerRows) applyRowStyle(ws, r, { ...bold, ...gray, ...centered });

    for (let r = 0; r < aoa.length; r++) {
      const rowHasData = aoa[r].some((x) => String(x ?? "").trim() !== "");
      if (rowHasData) applyRowStyle(ws, r, borderAll);
      if (totalRows.includes(r)) applyRowStyle(ws, r, { ...bold, ...borderTopStrong });
      setStyle(ws, r, 3, right);
      setStyle(ws, r, 2, right);
      for (let c = 0; c < COLS; c++) {
        if (typeof aoa[r]?.[c] === "number") {
          const addr = XLSX.utils.encode_cell({ r, c });
          const cell = ws[addr] as XLSX.CellObject | undefined;
          if (cell) {
            cell.t = "n";
            cell.z = CURRENCY_FMT;
          }
        }
      }
    }

    for (let r = uaGridStartRow; r < uaGridStartRow + 5; r++) applyRowStyle(ws, r, borderAll, 0, 3);
    if (firstTextBoxRow >= 0) {
      for (let r = firstTextBoxRow; r < aoa.length; r++) {
        if (String(aoa[r]?.[0] ?? "").trim()) applyRowStyle(ws, r, borderAll, 0, 3);
      }
    }

    const saldoRow = saldoRowExpected;
    if (saldoRow >= 0) {
      setStyle(
        ws,
        saldoRow,
        3,
        props.saldoFinal >= 0 ? { font: { color: { rgb: "008000" }, bold: true } } : { font: { color: { rgb: "CC0000" }, bold: true } }
      );
    }
    applyRowStyle(ws, uaTitleRow, { ...centered, ...underline });
    applyRowStyle(ws, concTitleRow, { ...centered, ...bold });
    applyRowStyle(ws, concPeriodRow, centered);
    applyRowStyle(ws, compromisosHeaderRow, bold);

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Informe");
    const filename = `Informe_Tesoreria_${props.informe.fechaDesde
      .toISOString()
      .slice(0, 10)}.xlsx`;
    XLSX.writeFile(wb, filename);
  };

  return (
    <Button type="button" variant="outline" onClick={onExport}>
      <Download className="w-4 h-4 mr-2" />
      Exportar Excel
    </Button>
  );
}

