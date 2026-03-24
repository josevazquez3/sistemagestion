import * as XLSX from "xlsx";
import type { MayorCuenta, MayorMovimiento } from "@/types/tesoreria";

const COLS = 8;

/** `etiquetaArchivo`: ej. DDMMYYYY_DDMMYYYY para el nombre del .xlsx */
export function exportarMayoresExcel(
  cuentas: MayorCuenta[],
  movimientos: MayorMovimiento[],
  etiquetaArchivo: string
) {
  const byCuenta = new Map<number, MayorMovimiento[]>();
  for (const c of cuentas) byCuenta.set(c.id, []);
  for (const m of movimientos) {
    const arr = byCuenta.get(m.cuentaId);
    if (arr) arr.push(m);
  }

  const sortedCuentas = [...cuentas].sort(
    (a, b) => a.orden - b.orden || a.id - b.id
  );

  const aoa: (string | number | null)[][] = [];
  const merges: XLSX.Range[] = [];
  /** Filas de totales: { r, cImp, sumFromR, sumToR } en índices 0-based */
  const formulas: {
    r: number;
    cImp: number;
    sumFromR: number;
    sumToR: number;
  }[] = [];

  const titleRow: (string | number | null)[] = Array(COLS).fill("");
  titleRow[0] = "Mayores CUENTAS";
  aoa.push(titleRow);
  merges.push({ s: { r: 0, c: 0 }, e: { r: 0, c: COLS - 1 } });
  aoa.push([]);

  const chunks: MayorCuenta[][] = [];
  for (let i = 0; i < sortedCuentas.length; i += 4) {
    chunks.push(sortedCuentas.slice(i, i + 4));
  }

  if (chunks.length === 0) {
    aoa.push(["Sin cuentas definidas"]);
  }

  for (const chunk of chunks) {
    const baseRow = aoa.length;
    const headerRow: (string | number | null)[] = Array(COLS).fill("");
    for (let i = 0; i < 4; i++) {
      const cta = chunk[i];
      const c0 = i * 2;
      if (cta) {
        headerRow[c0] = cta.nombre;
        merges.push({ s: { r: baseRow, c: c0 }, e: { r: baseRow, c: c0 + 1 } });
      }
    }
    aoa.push(headerRow);

    const movsPorCuenta = chunk.map((c) =>
      c ? (byCuenta.get(c.id) ?? []).slice() : []
    );
    const H = Math.max(...movsPorCuenta.map((m) => m.length), 0);

    for (let r = 0; r < H; r++) {
      const row: (string | number | null)[] = Array(COLS).fill("");
      for (let i = 0; i < 4; i++) {
        const mov = movsPorCuenta[i]?.[r];
        if (mov) {
          // Positivo y numérico nativo para que en Excel se sume (no como texto)
          row[i * 2] = Math.abs(Number(mov.importe));
          row[i * 2 + 1] = mov.concepto;
        }
      }
      aoa.push(row);
    }

    const totalRow: (string | number | null)[] = Array(COLS).fill("");
    const totalR = aoa.length;
    for (let i = 0; i < 4; i++) {
      const cta = chunk[i];
      const colImp = i * 2;
      const colCon = i * 2 + 1;
      if (!cta) continue;
      totalRow[colCon] = "Total";
      if (H > 0) {
        const firstDataR = baseRow + 1;
        const lastDataR = baseRow + H;
        totalRow[colImp] = 0;
        formulas.push({
          r: totalR,
          cImp: colImp,
          sumFromR: firstDataR,
          sumToR: lastDataR,
        });
      } else {
        totalRow[colImp] = 0;
      }
    }
    aoa.push(totalRow);
    aoa.push([]);
  }

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!merges"] = merges;

  const numFormat = "#,##0.00";
  for (const f of formulas) {
    const addr = XLSX.utils.encode_cell({ r: f.r, c: f.cImp });
    const top = XLSX.utils.encode_cell({ r: f.sumFromR, c: f.cImp });
    const bot = XLSX.utils.encode_cell({ r: f.sumToR, c: f.cImp });
    ws[addr] = {
      t: "n",
      f: `SUM(${top}:${bot})`,
      z: numFormat,
    };
  }

  const ref = XLSX.utils.decode_range(ws["!ref"] ?? "A1");
  /** Columnas de importe (pares): forzar tipo numérico y valor absoluto por si el libro infirió texto */
  for (let R = ref.s.r; R <= ref.e.r; R++) {
    for (let C = 0; C < COLS; C += 2) {
      const addr = XLSX.utils.encode_cell({ r: R, c: C });
      const cell = ws[addr];
      if (!cell) continue;
      if ("f" in cell && cell.f) continue;
      const raw = cell.v;
      if (raw === "" || raw === null || raw === undefined) continue;
      let n: number;
      if (typeof raw === "number" && Number.isFinite(raw)) {
        n = Math.abs(raw);
      } else if (typeof raw === "string") {
        const t = raw.trim().replace(/\./g, "").replace(",", ".");
        n = Math.abs(Number(t));
      } else {
        continue;
      }
      if (!Number.isFinite(n)) continue;
      ws[addr] = { t: "n", v: n, z: numFormat };
    }
  }

  const a1 = ws.A1;
  if (a1) {
    (a1 as { s?: { font?: { bold: boolean } } }).s = { font: { bold: true } };
  }

  for (const m of merges) {
    const r = m.s.r;
    const addr = XLSX.utils.encode_cell({ r, c: m.s.c });
    const cell = ws[addr];
    if (cell) (cell as { s?: { font?: { bold: boolean } } }).s = { font: { bold: true } };
  }

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Mayores");
  const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  const safe = etiquetaArchivo.replace(/[^\dA-Za-z_-]/g, "_");
  const nombre = `Mayores_${safe || "periodo"}.xlsx`;
  const blob = new Blob([wbout], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
