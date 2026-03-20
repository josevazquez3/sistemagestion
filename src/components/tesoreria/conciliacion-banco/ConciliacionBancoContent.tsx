"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import * as XLSX from "xlsx";
import { Download, RefreshCw, Settings } from "lucide-react";
import { CalendarioConciliacion } from "./CalendarioConciliacion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const MESES_NOMBRE = [
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

const STORAGE_KEY_GASTOS = "gastosBancarios_codigos";
/** Saldo anterior unificado (todas las cuentas) */
const CUENTA_UNIFICADA_ID = 0;

type MovimientoExtractoRow = {
  id: number;
  fecha: string;
  codigoOperacion: string;
  concepto: string;
  importe: number;
  cuentaNombre: string | null;
};

type CobroCertificacionRow = {
  id: string;
  fecha: string;
  detalle: string;
  importe: number;
};

type ReintegroFondoFijoRow = {
  id: number;
  fecha: string;
  detalle: string;
  importe: number;
};

type MovimientoConciliacion = {
  fecha: string | null;
  detalle: string;
  importe: number;
  tipo: "ingreso" | "retiro";
  origen: string;
};

function round2(n: number): number {
  return Math.round((Number(n) || 0) * 100) / 100;
}

/** Clave para agrupar / localStorage: código operativo o id:{id} si viene vacío */
function keyOperativoMovimiento(m: MovimientoExtractoRow): string {
  const c = (m.codigoOperacion ?? "").trim();
  return c.length > 0 ? c : `id:${m.id}`;
}

/** DD/MM/YYYY para UI y Excel */
function fmtFechaCorta(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

function fmtARS(n: number): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 2,
  }).format(round2(n));
}

/** Saldo en input: miles con punto, decimales con coma (ej. 1.234.567,89) — sin $ */
function fmtSaldoNumeroAR(n: number): string {
  if (!Number.isFinite(n)) return "0,00";
  return new Intl.NumberFormat("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(round2(n));
}

/** Interpreta el texto del input (miles . y decimales ,) como número */
function parseSaldoAR(input: string): number {
  const s = input.trim().replace(/\s/g, "");
  if (!s) return NaN;
  const lastComma = s.lastIndexOf(",");
  if (lastComma >= 0) {
    const intPart =
      s.slice(0, lastComma).replace(/\./g, "").replace(/[^\d]/g, "") || "0";
    let decPart = s.slice(lastComma + 1).replace(/\D/g, "").slice(0, 2);
    if (decPart.length === 0) decPart = "00";
    else if (decPart.length === 1) decPart = `${decPart}0`;
    return round2(Number(`${intPart}.${decPart}`));
  }
  const intOnly = s.replace(/\./g, "").replace(/[^\d]/g, "");
  if (intOnly === "") return NaN;
  return round2(Number(intOnly));
}

function sanitizeNombreArchivo(s: string): string {
  return String(s)
    .replace(/[/\\?%*:|"<>]/g, "_")
    .replace(/\s+/g, "_")
    .slice(0, 80);
}

function readGastosBancariosFromLS(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_GASTOS);
    if (!raw) return [];
    const p = JSON.parse(raw) as unknown;
    return Array.isArray(p) ? p.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function esDevolucionConcepto(concepto: string): boolean {
  return /devoluci[oó]n/i.test(concepto);
}

function esFondoFijoConcepto(concepto: string): boolean {
  return /f\.?\s*fijo|fondo\s*fijo/i.test(concepto);
}

export function ConciliacionBancoContent() {
  const hoy = new Date();
  const [mes, setMes] = useState(hoy.getMonth() + 1);
  const [anio, setAnio] = useState(hoy.getFullYear());
  const [saldoAnterior, setSaldoAnterior] = useState(0);
  const [saldoEdit, setSaldoEdit] = useState("0,00");
  const [movimientosExtracto, setMovimientosExtracto] = useState<MovimientoExtractoRow[]>([]);
  const [cobrosCertificacion, setCobrosCertificacion] = useState<CobroCertificacionRow[]>([]);
  const [reintegrosFondoFijo, setReintegrosFondoFijo] = useState<ReintegroFondoFijoRow[]>([]);
  const [generado, setGenerado] = useState(false);
  const [loadingSaldo, setLoadingSaldo] = useState(false);
  const [loadingEstado, setLoadingEstado] = useState(false);
  const [mensaje, setMensaje] = useState<{ tipo: "ok" | "error"; text: string } | null>(null);
  const [gastosBancariosCodigos, setGastosBancariosCodigos] = useState<string[]>([]);
  const [modalGastosOpen, setModalGastosOpen] = useState(false);
  const [draftGastosCodigos, setDraftGastosCodigos] = useState<string[]>([]);

  const showMessage = useCallback((tipo: "ok" | "error", text: string) => {
    setMensaje({ tipo, text });
    setTimeout(() => setMensaje(null), 4000);
  }, []);

  const limpiarVista = useCallback(() => {
    setMovimientosExtracto([]);
    setCobrosCertificacion([]);
    setReintegrosFondoFijo([]);
    setGenerado(false);
  }, []);

  useEffect(() => {
    limpiarVista();
  }, [mes, anio, limpiarVista]);

  const cargarSaldoAnterior = useCallback(async () => {
    setLoadingSaldo(true);
    try {
      const res = await fetch(
        `/api/conciliacion/saldo-anterior?cuentaId=${CUENTA_UNIFICADA_ID}&mes=${mes}&anio=${anio}`
      );
      const data = await res.json();
      if (res.ok) {
        const raw = data.saldo;
        const s = round2(raw == null ? 0 : Number(raw));
        setSaldoAnterior(s);
        setSaldoEdit(fmtSaldoNumeroAR(s));
      }
    } finally {
      setLoadingSaldo(false);
    }
  }, [mes, anio]);

  useEffect(() => {
    void cargarSaldoAnterior();
  }, [cargarSaldoAnterior]);

  const guardarSaldo = async () => {
    const saldo = parseSaldoAR(saldoEdit);
    if (!Number.isFinite(saldo) || Number.isNaN(saldo)) {
      showMessage("error", "Saldo inválido (usá miles con punto y decimales con coma, ej. 500.000,50)");
      return;
    }
    const res = await fetch("/api/conciliacion/saldo-anterior", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cuentaId: CUENTA_UNIFICADA_ID, mes, anio, saldo }),
    });
    if (res.ok) {
      setSaldoAnterior(saldo);
      setSaldoEdit(fmtSaldoNumeroAR(saldo));
      showMessage("ok", "Saldo anterior guardado");
    } else {
      showMessage("error", "No se pudo guardar el saldo anterior");
    }
  };

  const gruposNegativos = useMemo(() => {
    const map = new Map<string, { key: string; concepto: string; total: number }>();
    for (const m of movimientosExtracto) {
      if (m.importe >= 0) continue;
      const key = keyOperativoMovimiento(m);
      const abs = round2(Math.abs(m.importe));
      if (!map.has(key)) {
        map.set(key, {
          key,
          concepto: (m.concepto ?? "").trim() || "—",
          total: 0,
        });
      }
      const g = map.get(key)!;
      g.total = round2(g.total + abs);
    }
    return Array.from(map.values()).sort((a, b) => a.key.localeCompare(b.key, "es"));
  }, [movimientosExtracto]);

  const abrirModalGastos = () => {
    setDraftGastosCodigos([...gastosBancariosCodigos]);
    setModalGastosOpen(true);
  };

  const aplicarGastosBancarios = () => {
    const valid = new Set(gruposNegativos.map((g) => g.key));
    const applied = draftGastosCodigos.filter((k) => valid.has(k));
    const prev = readGastosBancariosFromLS();
    const mergedLS = Array.from(
      new Set([...prev.filter((k) => !valid.has(k)), ...applied])
    );
    setGastosBancariosCodigos(applied);
    try {
      localStorage.setItem(STORAGE_KEY_GASTOS, JSON.stringify(mergedLS));
    } catch {
      showMessage("error", "No se pudo guardar en el navegador");
      return;
    }
    setModalGastosOpen(false);
    showMessage("ok", "Configuración de gastos bancarios aplicada");
  };

  const toggleDraftCodigo = (key: string) => {
    setDraftGastosCodigos((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const generarVista = async () => {
    setLoadingEstado(true);
    try {
      const res = await fetch(
        `/api/tesoreria/conciliacion-banco/estado-mensual?mes=${mes}&anio=${anio}`
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Error al cargar");

      const extracto: MovimientoExtractoRow[] = Array.isArray(json?.data?.movimientosExtracto)
        ? json.data.movimientosExtracto
        : [];
      const cobros: CobroCertificacionRow[] = Array.isArray(json?.data?.cobrosCertificacion)
        ? json.data.cobrosCertificacion
        : [];
      const fondos: ReintegroFondoFijoRow[] = Array.isArray(json?.data?.reintegrosFondoFijo)
        ? json.data.reintegrosFondoFijo
        : [];

      const keysSet = new Set(
        extracto.filter((m) => m.importe < 0).map((m) => keyOperativoMovimiento(m))
      );
      const saved = readGastosBancariosFromLS();
      const merged = saved.filter((k) => keysSet.has(k));

      setMovimientosExtracto(extracto);
      setCobrosCertificacion(cobros);
      setReintegrosFondoFijo(fondos);
      setGastosBancariosCodigos(merged);
      setGenerado(true);
    } catch {
      showMessage("error", "Error al generar la vista previa");
      limpiarVista();
    } finally {
      setLoadingEstado(false);
    }
  };

  const movimientosTabla = useMemo(() => {
    const gastosSet = new Set(gastosBancariosCodigos);

    const distritos = movimientosExtracto.filter(
      (m) =>
        m.importe > 0 && (m.cuentaNombre?.toLowerCase().includes("distrito") ?? false)
    );
    const certificaciones = [...cobrosCertificacion].sort(
      (a, b) => +new Date(a.fecha) - +new Date(b.fecha)
    );

    const devoluciones = movimientosExtracto.filter(
      (m) => m.importe < 0 && esDevolucionConcepto(m.concepto)
    );

    const fondoExtracto = movimientosExtracto.filter(
      (m) =>
        m.importe < 0 &&
        esFondoFijoConcepto(m.concepto) &&
        !esDevolucionConcepto(m.concepto) &&
        !gastosSet.has(keyOperativoMovimiento(m))
    );

    const gastosMovs = movimientosExtracto.filter(
      (m) =>
        m.importe < 0 &&
        gastosSet.has(keyOperativoMovimiento(m)) &&
        !esDevolucionConcepto(m.concepto) &&
        !esFondoFijoConcepto(m.concepto)
    );

    const restoRetiros = movimientosExtracto.filter(
      (m) =>
        m.importe < 0 &&
        !gastosSet.has(keyOperativoMovimiento(m)) &&
        !esDevolucionConcepto(m.concepto) &&
        !esFondoFijoConcepto(m.concepto)
    );

    const totalGastosBancarios = round2(
      gastosMovs.reduce((acc, m) => acc + Math.abs(m.importe), 0)
    );

    const sortExt = (arr: MovimientoExtractoRow[]) =>
      [...arr].sort((a, b) => +new Date(a.fecha) - +new Date(b.fecha));

    const rows: MovimientoConciliacion[] = [];

    for (const m of sortExt(distritos)) {
      rows.push({
        fecha: m.fecha,
        detalle: (m.concepto ?? "").trim() || "—",
        importe: round2(Math.abs(m.importe)),
        tipo: "ingreso",
        origen: "TransferenciaDistritos",
      });
    }

    for (const c of certificaciones) {
      rows.push({
        fecha: c.fecha,
        detalle: `COBRO CERTIFICACIÓN - ${c.detalle}`,
        importe: round2(Math.abs(c.importe)),
        tipo: "ingreso",
        origen: "CobroCertificacion",
      });
    }

    const fondoFilas: MovimientoConciliacion[] = [];
    for (const m of sortExt(fondoExtracto)) {
      fondoFilas.push({
        fecha: m.fecha,
        detalle: (m.concepto ?? "").trim() || "—",
        importe: round2(Math.abs(m.importe)),
        tipo: "retiro",
        origen: "FondoFijoExtracto",
      });
    }
    for (const r of [...reintegrosFondoFijo].sort(
      (a, b) => +new Date(a.fecha) - +new Date(b.fecha)
    )) {
      fondoFilas.push({
        fecha: r.fecha,
        detalle: r.detalle,
        importe: round2(r.importe),
        tipo: "retiro",
        origen: "FondoFijoTabla",
      });
    }
    fondoFilas.sort((a, b) => {
      const ta = a.fecha ? +new Date(a.fecha) : 0;
      const tb = b.fecha ? +new Date(b.fecha) : 0;
      return ta - tb;
    });

    for (const m of sortExt(devoluciones)) {
      rows.push({
        fecha: m.fecha,
        detalle: (m.concepto ?? "").trim() || "—",
        importe: round2(Math.abs(m.importe)),
        tipo: "retiro",
        origen: "DevolucionCertificacion",
      });
    }

    rows.push(...fondoFilas);

    for (const m of sortExt(restoRetiros)) {
      rows.push({
        fecha: m.fecha,
        detalle: (m.concepto ?? "").trim() || "—",
        importe: round2(Math.abs(m.importe)),
        tipo: "retiro",
        origen: "RestoExtracto",
      });
    }

    if (gastosBancariosCodigos.length > 0 && totalGastosBancarios > 0) {
      rows.push({
        fecha: null,
        detalle: "gastos bancarios",
        importe: totalGastosBancarios,
        tipo: "retiro",
        origen: "GastoBancario",
      });
    }

    return rows;
  }, [
    movimientosExtracto,
    cobrosCertificacion,
    reintegrosFondoFijo,
    gastosBancariosCodigos,
  ]);

  const totales = useMemo(() => {
    let totalIngresos = 0;
    let totalRetiros = 0;
    for (const m of movimientosTabla) {
      if (m.tipo === "ingreso") totalIngresos = round2(totalIngresos + m.importe);
      else totalRetiros = round2(totalRetiros + m.importe);
    }
    const ingresosMasSaldo = round2(totalIngresos + saldoAnterior);
    const totalFinal = round2(ingresosMasSaldo - totalRetiros);
    return { totalIngresos, totalRetiros, ingresosMasSaldo, totalFinal };
  }, [movimientosTabla, saldoAnterior]);

  const exportarExcel = () => {
    if (!generado) {
      showMessage("error", "Generá primero la vista previa");
      return;
    }

    const mesNombre = MESES_NOMBRE[mes - 1] ?? String(mes);
    const fechaInicio = new Date(anio, mes - 1, 1);
    const fechaFin = new Date(anio, mes, 0);
    const fIni = fmtFechaCorta(fechaInicio.toISOString());
    const fFin = fmtFechaCorta(fechaFin.toISOString());

    const M = movimientosTabla.length;
    const firstDataRow = 5;
    const lastDataRow = 4 + M;
    const totalsRow = 5 + M;
    const ingresosSaldoRow = totalsRow + 3;
    const totalFinalRow = totalsRow + 5;

    const dataRows = movimientosTabla.map((m) => [
      m.fecha ? fmtFechaCorta(m.fecha) : "",
      m.detalle,
      m.tipo === "ingreso" ? round2(m.importe) : "",
      m.tipo === "retiro" ? round2(m.importe) : "",
      "",
    ]);
    const aoa: (string | number)[][] = [
      ["", fIni, "", "", "FECHA"],
      ["", "", "", "", fFin],
      ["fecha", "DETALLE", "Ingreso", "retiros", "SALDO ANTERIOR"],
      ["", "", "", "", round2(saldoAnterior)],
      ...dataRows,
      ["", "", "", "", ""],
      ["", "", "", "", ""],
      ["", "", "", "", ""],
      ["INGRESOS + SALDO ANTERIOR:", "", "", "", ""],
      ["", "", "", "", ""],
      ["", "TOTAL", "", "", ""],
    ];

    const ws = XLSX.utils.aoa_to_sheet(aoa);

    const setFormula = (r: number, c: number, f: string) => {
      const addr = XLSX.utils.encode_cell({ r, c });
      ws[addr] = { f, t: "n" };
    };

    setFormula(totalsRow - 1, 2, `SUM(C${firstDataRow}:C${lastDataRow})`);
    setFormula(totalsRow - 1, 3, `SUM(D${firstDataRow}:D${lastDataRow})`);
    setFormula(ingresosSaldoRow - 1, 2, `C${totalsRow}+E4`);
    setFormula(totalFinalRow - 1, 2, `C${ingresosSaldoRow}-D${totalsRow}`);

    const boldRow = (r0: number) => {
      for (let c = 0; c < 5; c++) {
        const addr = XLSX.utils.encode_cell({ r: r0, c });
        const cell = ws[addr];
        if (cell) (cell as { s?: { font?: { bold?: boolean } } }).s = { font: { bold: true } };
      }
    };
    boldRow(2);
    boldRow(totalsRow - 1);
    boldRow(ingresosSaldoRow - 1);
    boldRow(totalFinalRow - 1);

    ws["!cols"] = [
      { wch: 15 },
      { wch: 70 },
      { wch: 18 },
      { wch: 18 },
      { wch: 20 },
    ];

    const ref = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: aoa.length - 1, c: 4 } });
    ws["!ref"] = ref;

    const wb = XLSX.utils.book_new();
    const sheetName = `Conciliacion ${mesNombre} ${anio}`.slice(0, 31);
    XLSX.utils.book_append_sheet(wb, ws, sheetName);

    const file = `Conciliacion_${sanitizeNombreArchivo(mesNombre)}_${anio}.xlsx`;
    XLSX.writeFile(wb, file);
    showMessage("ok", "Excel descargado");
  };

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Conciliación Banco</h1>
        <p className="mt-1 text-sm text-gray-500">
          Vista mensual unificada de todas las cuentas: ingresos, retiros y saldo final.
        </p>
      </div>

      {mensaje && (
        <div
          className={`fixed right-4 top-4 z-[100] rounded-xl px-4 py-3 text-sm font-medium shadow-lg ${
            mensaje.tipo === "ok" ? "bg-emerald-600 text-white" : "bg-red-600 text-white"
          }`}
        >
          {mensaje.tipo === "ok" ? "✓" : "✗"} {mensaje.text}
        </div>
      )}

      <Dialog open={modalGastosOpen} onOpenChange={setModalGastosOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Configurar Gastos Bancarios</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600 shrink-0">
            Marcá los códigos de operación de movimientos <strong>negativos</strong> del extracto que
            correspondan a gastos bancarios. Se mostrarán agrupados en una sola línea al final de los
            retiros.
          </p>
          <div className="min-h-0 flex-1 overflow-auto rounded-lg border border-gray-200">
            {gruposNegativos.length === 0 ? (
              <p className="p-4 text-sm text-gray-500">
                No hay movimientos negativos en el período generado. Primero generá la vista.
              </p>
            ) : (
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-gray-100 z-10 border-b">
                  <tr>
                    <th className="w-10 px-2 py-2 text-left" />
                    <th className="px-2 py-2 text-left font-semibold">Código</th>
                    <th className="px-2 py-2 text-left font-semibold">Concepto</th>
                    <th className="px-2 py-2 text-right font-semibold">Total período</th>
                  </tr>
                </thead>
                <tbody>
                  {gruposNegativos.map((g) => (
                    <tr key={g.key} className="border-b border-gray-100 hover:bg-gray-50/80">
                      <td className="px-2 py-2 align-top">
                        <Checkbox
                          checked={draftGastosCodigos.includes(g.key)}
                          onCheckedChange={() => toggleDraftCodigo(g.key)}
                          aria-label={`Gasto bancario ${g.key}`}
                        />
                      </td>
                      <td className="px-2 py-2 align-top font-mono text-xs">{g.key}</td>
                      <td className="px-2 py-2 align-top text-gray-800">{g.concepto}</td>
                      <td className="px-2 py-2 align-top text-right tabular-nums font-medium text-red-800">
                        {fmtARS(g.total)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setModalGastosOpen(false)}>
              Cancelar
            </Button>
            <Button
              type="button"
              className="bg-emerald-600 hover:bg-emerald-700"
              onClick={aplicarGastosBancarios}
              disabled={!generado}
            >
              Aplicar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="flex flex-wrap items-end gap-3">
        <CalendarioConciliacion
          mes={mes}
          anio={anio}
          onChange={(m, a) => {
            setMes(m);
            setAnio(a);
          }}
        />

        <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-2">
          <div className="text-xs font-medium text-blue-900">Saldo Anterior</div>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <Input
              value={saldoEdit}
              onChange={(e) => setSaldoEdit(e.target.value)}
              onBlur={() => {
                const n = parseSaldoAR(saldoEdit);
                if (Number.isFinite(n) && !Number.isNaN(n)) {
                  setSaldoEdit(fmtSaldoNumeroAR(n));
                }
              }}
              disabled={loadingSaldo}
              inputMode="decimal"
              placeholder="0,00"
              title="Miles con punto · Decimales con coma (ej. 500.000,50)"
              className="h-8 min-w-[10rem] w-44 bg-white tabular-nums"
            />
            <Button type="button" size="sm" variant="secondary" onClick={guardarSaldo}>
              Guardar
            </Button>
          </div>
          <div className="mt-1 text-xs text-blue-800">Persistido (vista unificada): {fmtARS(saldoAnterior)}</div>
        </div>

        <Button
          type="button"
          onClick={generarVista}
          disabled={loadingEstado}
          className="bg-emerald-600 hover:bg-emerald-700"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${loadingEstado ? "animate-spin" : ""}`} />
          Generar / Actualizar Vista
        </Button>

        <Button type="button" variant="outline" onClick={exportarExcel} disabled={!generado}>
          <Download className="h-4 w-4 mr-2" />
          Exportar Excel
        </Button>

        <Button type="button" variant="outline" onClick={abrirModalGastos} disabled={!generado}>
          <Settings className="h-4 w-4 mr-2" />
          ⚙ Gastos Bancarios
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 px-4 py-3">
          <div className="text-xs text-emerald-900">Total Ingresos</div>
          <div className="text-lg font-semibold text-emerald-800 tabular-nums">{fmtARS(totales.totalIngresos)}</div>
        </div>
        <div className="rounded-xl border border-red-200 bg-red-50/80 px-4 py-3">
          <div className="text-xs text-red-900">Total Retiros</div>
          <div className="text-lg font-semibold text-red-800 tabular-nums">{fmtARS(totales.totalRetiros)}</div>
        </div>
        <div className="rounded-xl border border-blue-200 bg-blue-50/80 px-4 py-3">
          <div className="text-xs text-blue-900">Ingresos + Saldo Anterior</div>
          <div className="text-lg font-semibold text-blue-800 tabular-nums">{fmtARS(totales.ingresosMasSaldo)}</div>
        </div>
        <div
          className={`rounded-xl border px-4 py-3 ${
            Math.abs(totales.totalFinal) < 0.005
              ? "border-emerald-300 bg-emerald-50"
              : "border-amber-200 bg-amber-50"
          }`}
        >
          <div className="text-xs font-medium text-gray-800">TOTAL FINAL</div>
          <div className="text-lg font-bold tabular-nums text-gray-900">{fmtARS(totales.totalFinal)}</div>
        </div>
      </div>

      {!generado ? (
        <p className="text-sm text-gray-500 py-8 text-center">
          Elegí el período, ajustá el saldo anterior si hace falta y presioná{" "}
          <strong>Generar / Actualizar Vista</strong>.
        </p>
      ) : (
        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-100 border-b">
                  <th className="text-left px-3 py-2 font-semibold w-28">Fecha</th>
                  <th className="text-left px-3 py-2 font-semibold">Detalle</th>
                  <th className="text-right px-3 py-2 font-semibold w-36">Ingreso</th>
                  <th className="text-right px-3 py-2 font-semibold w-36">Retiro</th>
                </tr>
              </thead>
              <tbody>
                {movimientosTabla.map((m, i) => (
                  <tr key={`${m.origen}-${i}-${m.detalle.slice(0, 40)}`} className="border-b border-gray-100">
                    <td className="px-3 py-2 whitespace-nowrap">{m.fecha ? fmtFechaCorta(m.fecha) : ""}</td>
                    <td className="px-3 py-2">{m.detalle}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-emerald-700 font-medium">
                      {m.tipo === "ingreso" ? fmtARS(m.importe) : ""}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-red-700 font-medium">
                      {m.tipo === "retiro" ? fmtARS(m.importe) : ""}
                    </td>
                  </tr>
                ))}
                <tr className="bg-gray-700 text-white">
                  <td className="px-3 py-3" />
                  <td className="px-3 py-3 font-semibold">TOTALES</td>
                  <td className="px-3 py-3 text-right font-bold tabular-nums">{fmtARS(totales.totalIngresos)}</td>
                  <td className="px-3 py-3 text-right font-bold tabular-nums">{fmtARS(totales.totalRetiros)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
