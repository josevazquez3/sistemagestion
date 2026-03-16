"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Calendar,
  DollarSign,
  Pencil,
  X,
  RefreshCw,
  MinusCircle,
  Search,
  Upload,
  Download,
  ChevronDown,
  Trash2,
  FileText,
} from "lucide-react";
import { formatearImporteAR, parsearArchivoExtracto } from "@/lib/parsearExtracto";
import { parsearExcelGenerico, type MovimientoImportado } from "@/lib/tesoreria/parsearImportFlex";
import { ModalGasto } from "./ModalGasto";
import { ModalEditarMovimiento, type MovimientoFondoFijo } from "./ModalEditarMovimiento";
import { MultiCodigoInput } from "../MultiCodigoInput";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

const TZ = "America/Argentina/Buenos_Aires";

function formatFecha(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("es-AR", {
      timeZone: TZ,
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return iso.slice(0, 10);
  }
}

type ConfigFondo = {
  mes: number;
  anio: number;
  codigosOperativos: string[];
  saldoAnterior: number | null;
};

export function FondoFijoContent() {
  const hoy = new Date();
  const [mes, setMes] = useState(hoy.getMonth() + 1);
  const [anio, setAnio] = useState(hoy.getFullYear());
  const [movimientos, setMovimientos] = useState<MovimientoFondoFijo[]>([]);
  const [config, setConfig] = useState<ConfigFondo>({
    mes: 0,
    anio: 0,
    codigosOperativos: [],
    saldoAnterior: null,
  });
  const [loading, setLoading] = useState(true);
  const [mensaje, setMensaje] = useState<{ tipo: "ok" | "error"; text: string } | null>(null);
  const [modalGasto, setModalGasto] = useState(false);
  const [modalEditar, setModalEditar] = useState(false);
  const [movimientoEditar, setMovimientoEditar] = useState<MovimientoFondoFijo | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [añoPicker, setAñoPicker] = useState(anio);
  const pickerRef = useRef<HTMLDivElement>(null);
  const [saldoPopoverOpen, setSaldoPopoverOpen] = useState(false);
  const [saldoAnteriorInput, setSaldoAnteriorInput] = useState("");
  const [menuExportarOpen, setMenuExportarOpen] = useState(false);
  const [buscar, setBuscar] = useState("");
  const [cargandoActualizar, setCargandoActualizar] = useState(false);
  const [importando, setImportando] = useState(false);
  const inputImportarRef = useRef<HTMLInputElement>(null);
  const [saldoTotal, setSaldoTotal] = useState<number>(0);

  const fetchMovimientos = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ mes: String(mes), anio: String(anio) });
      if (buscar) params.set("buscar", buscar);
      const res = await fetch(`/api/tesoreria/fondo-fijo?${params}`);
      const data = await res.json();
      if (res.ok) {
        const lista = Array.isArray(data) ? data : [];
        setMovimientos(lista);
        // Saldo del último movimiento del período (la API devuelve orden fecha asc)
        if (lista.length > 0) {
          setSaldoTotal(lista[lista.length - 1].saldoPesos ?? 0);
        } else {
          setSaldoTotal(0);
        }
      } else {
        setMovimientos([]);
        setSaldoTotal(0);
      }
    } catch {
      setMovimientos([]);
      setSaldoTotal(0);
    } finally {
      setLoading(false);
    }
  }, [mes, anio, buscar]);

  const fetchConfig = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/tesoreria/fondo-fijo/config?mes=${mes}&anio=${anio}`
      );
      const data = await res.json();
      if (res.ok)
        setConfig({
          mes: data.mes ?? mes,
          anio: data.anio ?? anio,
          codigosOperativos: Array.isArray(data.codigosOperativos) ? data.codigosOperativos : [],
          saldoAnterior: data.saldoAnterior ?? null,
        });
    } catch {
      setConfig((c) => ({ ...c, codigosOperativos: [], saldoAnterior: null }));
    }
  }, [mes, anio]);

  useEffect(() => {
    fetchMovimientos();
  }, [fetchMovimientos]);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  useEffect(() => {
    if (pickerOpen) setAñoPicker(anio);
  }, [pickerOpen, anio]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (pickerRef.current && !pickerRef.current.contains(target)) {
        setPickerOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!mensaje) return;
    const t = setTimeout(() => setMensaje(null), 4000);
    return () => clearTimeout(t);
  }, [mensaje]);

  const showMessage = useCallback((tipo: "ok" | "error", text: string) => {
    setMensaje({ tipo, text });
  }, []);

  const nombreMes = MESES[mes - 1];

  const seleccionarMes = (m: number) => {
    setMes(m);
    setAnio(añoPicker);
    setPickerOpen(false);
  };

  const esteMes = () => {
    const now = new Date();
    setMes(now.getMonth() + 1);
    setAnio(now.getFullYear());
    setPickerOpen(false);
  };

  const guardarSaldoAnterior = async () => {
    const valor = saldoAnteriorInput.replace(/\./g, "").replace(",", ".");
    const num = parseFloat(valor);
    if (Number.isNaN(num) && saldoAnteriorInput.trim() !== "") {
      showMessage("error", "Importe inválido.");
      return;
    }
    const saldo = saldoAnteriorInput.trim() === "" ? null : num;
    try {
      const res = await fetch("/api/tesoreria/fondo-fijo/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mes, anio, saldoAnterior: saldo }),
      });
      if (res.ok) {
        setConfig((c) => ({ ...c, saldoAnterior: saldo }));
        setSaldoPopoverOpen(false);
        setSaldoAnteriorInput("");
        fetchMovimientos();
        showMessage("ok", "Saldo anterior guardado.");
      } else {
        const data = await res.json();
        showMessage("error", data.error || "Error al guardar");
      }
    } catch {
      showMessage("error", "Error de conexión");
    }
  };

  const guardarCodigos = async (codigos: string[]) => {
    try {
      const res = await fetch("/api/tesoreria/fondo-fijo/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mes, anio, codigosOperativos: codigos }),
      });
      if (res.ok) {
        setConfig((c) => ({ ...c, codigosOperativos: codigos }));
        fetchConfig();
        showMessage("ok", "Códigos operativos guardados.");
      } else {
        const data = await res.json();
        showMessage("error", data.error || "Error al guardar");
      }
    } catch {
      showMessage("error", "Error de conexión");
    }
  };

  const actualizarIngresos = async () => {
    if (config.codigosOperativos.length === 0) {
      showMessage("error", "Agregá al menos un código operativo.");
      return;
    }
    setCargandoActualizar(true);
    try {
      const res = await fetch("/api/tesoreria/fondo-fijo/actualizar-ingresos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mes, anio }),
      });
      const data = await res.json();
      if (res.ok) {
        const n = data.importados ?? 0;
        if (n > 0) showMessage("ok", `${n} ingreso(s) importados.`);
        else showMessage("ok", "No se encontraron movimientos para ese período y códigos operativos.");
        fetchMovimientos();
      } else {
        showMessage("error", data.error || "Error al actualizar ingresos.");
      }
    } catch {
      showMessage("error", "Error de conexión");
    } finally {
      setCargandoActualizar(false);
    }
  };

  const eliminarMovimiento = (mov: MovimientoFondoFijo) => {
    if (!confirm("¿Eliminar este movimiento?")) return;
    fetch(`/api/tesoreria/fondo-fijo/${mov.id}`, { method: "DELETE" })
      .then((res) => {
        if (res.ok) {
          showMessage("ok", "Movimiento eliminado.");
          fetchMovimientos();
        } else {
          res.json().then((d) => showMessage("error", d.error || "Error al eliminar"));
        }
      })
      .catch(() => showMessage("error", "Error de conexión"));
  };

  const exportar = async (formato: "xlsx" | "pdf") => {
    try {
      const saldoAnt = Number(config.saldoAnterior ?? 0);
      const movs = movimientos.map((m) => {
        const imp = Number(m.importePesos ?? 0);
        const sal = Number(m.saldoPesos ?? 0);
        return {
          fecha: formatFecha(m.fecha),
          concepto: m.concepto,
          importe: imp,
          saldo: sal,
          importeFormato: formatearImporteAR(imp),
          saldoFormato: formatearImporteAR(sal),
        };
      });
      const totalIngresos = movimientos
        .filter((m) => Number(m.importePesos ?? 0) > 0)
        .reduce((s, m) => s + Number(m.importePesos ?? 0), 0);
      const totalGastos = movimientos
        .filter((m) => Number(m.importePesos ?? 0) < 0)
        .reduce((s, m) => s + Number(m.importePesos ?? 0), 0);
      const saldoFinal =
        movs.length > 0 ? movs[movs.length - 1].saldo : saldoAnt;
      const titulo = `Fondo Fijo - ${nombreMes} ${anio}`;
      const saldoAntFormato = formatearImporteAR(saldoAnt);
      const nombreMesAnio = `FondoFijo_${nombreMes}_${anio}`;

      if (formato === "xlsx") {
        const mod = await import("xlsx");
        const XLSX = (mod as { default?: unknown }).default ?? mod;
        if (!XLSX || typeof (XLSX as { utils?: unknown }).utils !== "object") {
          throw new Error("Módulo xlsx no disponible. Recargá la página e intentá de nuevo.");
        }
        const xlsxUtils = (XLSX as { utils: { aoa_to_sheet: (a: unknown[]) => unknown; book_new: () => unknown; book_append_sheet: (wb: unknown, ws: unknown, name: string) => void }; write: (wb: unknown, opts: { bookType: string; type: string }) => unknown }).utils;
        type MovExport = { fecha: string; concepto: string; importe: number; saldo: number };
        const hasSaldoAnt = saldoAnt !== 0;
        const filas: (string | number)[][] = [
          [titulo],
          [],
          ["Fecha", "Concepto", "Importe", "Saldo"],
          ...(hasSaldoAnt ? [["", "Saldo Anterior", saldoAnt, saldoAnt] as (string | number)[]] : []),
          ...(movs as MovExport[]).map((m) => [m.fecha, m.concepto, m.importe, m.saldo]),
          [],
          ["Total ingresos", "", totalIngresos, ""],
          ["Total gastos", "", Math.abs(totalGastos), ""],
          ["Saldo final", "", "", saldoFinal],
        ];
        const ws = xlsxUtils.aoa_to_sheet(filas) as Record<string, { t?: string; z?: string }>;

        const wb = xlsxUtils.book_new();
        xlsxUtils.book_append_sheet(wb, ws, "Fondo Fijo");
        const wbout = (XLSX as { write: (wb: unknown, opts: { bookType: string; type: string }) => unknown }).write(wb, { bookType: "xlsx", type: "array" });
        const blob = new Blob([wbout], {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${nombreMesAnio}.xlsx`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showMessage("ok", "Excel exportado.");
      } else {
        const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
        doc.setFontSize(14);
        doc.text(titulo, 14, 20);
        doc.setFontSize(10);
        doc.text(`Saldo anterior: ${saldoAntFormato}`, 14, 28);
        const tableData = [
          ...(saldoAnt !== 0 ? [["", "Saldo Anterior", saldoAntFormato, saldoAntFormato]] : []),
          ...movs.map((m) => [m.fecha, m.concepto, m.importeFormato, m.saldoFormato]),
        ];
        autoTable(doc, {
          startY: 34,
          head: [["Fecha", "Concepto", "Importe", "Saldo"]],
          body: tableData,
          theme: "grid",
        });
        const finalY = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable?.finalY ?? 34;
        doc.text(`Total ingresos: ${formatearImporteAR(totalIngresos)}`, 14, finalY + 8);
        doc.text(`Total gastos: ${formatearImporteAR(Math.abs(totalGastos))}`, 14, finalY + 14);
        doc.text(`Saldo final: ${formatearImporteAR(saldoFinal)}`, 14, finalY + 20);
        const pdfBlob = doc.output("blob");
        const pdfUrl = URL.createObjectURL(pdfBlob);
        const link = document.createElement("a");
        link.href = pdfUrl;
        link.download = `${nombreMesAnio}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(pdfUrl);
        showMessage("ok", "PDF exportado.");
      }
    } catch (err) {
      console.error("Error al exportar Fondo Fijo:", err);
      if (err instanceof Error) {
        console.error("Mensaje:", err.message);
        console.error("Stack:", err.stack);
      }
      showMessage("error", "Error al exportar. Intentá de nuevo.");
    } finally {
      setMenuExportarOpen(false);
    }
  };

  const handleImportar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    const extension = file.name.split(".").pop()?.toLowerCase();
    const esExcel = extension === "xls" || extension === "xlsx";
    const esTexto = extension === "csv" || extension === "txt";
    if (!esExcel && !esTexto) {
      showMessage("error", "Solo se permiten archivos .csv, .xls, .xlsx o .txt.");
      return;
    }

    setImportando(true);
    try {
      let movimientosParsados: MovimientoImportado[] = [];

      if (esExcel) {
        const mod = await import("xlsx");
        const XLSX = (mod as { default?: typeof mod }).default ?? mod;
        const buffer = await file.arrayBuffer();
        const wb = XLSX.read(buffer, { type: "array", cellDates: false });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const filas: unknown[][] = XLSX.utils.sheet_to_json(ws, {
          header: 1,
          defval: null,
        });
        movimientosParsados = parsearExcelGenerico(filas);
      } else {
        const texto = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (ev) => resolve((ev.target?.result as string) ?? "");
          reader.onerror = reject;
          reader.readAsText(file, "ISO-8859-1");
        });
        const parseados = parsearArchivoExtracto(texto);
        movimientosParsados = parseados.map((m) => ({
          fecha: new Date(m.fecha),
          concepto: m.concepto ?? "",
          importePesos: Number(m.importePesos) || 0,
          tipo:
            Number(m.importePesos) >= 0 || Number.isNaN(Number(m.importePesos))
              ? "INGRESO"
              : "GASTO",
        }));
      }

      if (movimientosParsados.length === 0) {
        showMessage("error", "No se encontraron movimientos válidos en el archivo.");
        return;
      }

      if (
        !confirm(
          `¿Importar ${movimientosParsados.length} movimiento(s) en ${nombreMes} ${anio}?`
        )
      ) {
        return;
      }

      let importados = 0;
      for (const m of movimientosParsados) {
        try {
          const res = await fetch("/api/tesoreria/fondo-fijo", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              fecha: m.fecha.toISOString(),
              concepto: m.concepto,
              importePesos: m.importePesos,
              mes,
              anio,
              tipo: m.tipo,
            }),
          });
          if (res.ok) importados++;
        } catch {
          // ignorar error por fila
        }
      }

      showMessage("ok", `Se importaron ${importados} movimiento(s) correctamente.`);
      fetchMovimientos();
    } catch {
      showMessage("error", "Error al importar el archivo. Verificá el formato.");
    } finally {
      setImportando(false);
    }
  };

  return (
    <div className="space-y-6 mt-6">
      {mensaje && (
        <div
          className={`rounded-lg border px-4 py-3 text-sm ${
            mensaje.tipo === "ok"
              ? "border-green-200 bg-green-50 text-green-800"
              : "border-red-200 bg-red-50 text-red-800"
          }`}
        >
          {mensaje.text}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 mb-4" ref={pickerRef}>
        <button
          type="button"
          onClick={() => setPickerOpen((o) => !o)}
          className="flex items-center gap-2 bg-sky-500 hover:bg-sky-600 text-white text-sm px-4 py-2 rounded-lg"
        >
          <Calendar className="w-4 h-4" />
          {nombreMes} de {anio}
        </button>

        {pickerOpen && (
          <div className="absolute left-4 top-24 z-50 w-[320px] rounded-xl border border-gray-200 bg-white p-4 shadow-lg">
            <div className="mb-4 text-center text-xl font-semibold text-gray-800">
              {añoPicker}
            </div>
            <div className="mb-2 flex justify-center gap-2">
              <button
                type="button"
                onClick={() => setAñoPicker((a) => a - 1)}
                className="rounded bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-200"
              >
                ← Año anterior
              </button>
              <button
                type="button"
                onClick={() => setAñoPicker((a) => a + 1)}
                className="rounded bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-200"
              >
                Año siguiente →
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {MESES.map((nombre, i) => {
                const m = i + 1;
                const activo = mes === m && anio === añoPicker;
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => seleccionarMes(m)}
                    className={`rounded-lg px-3 py-3 text-base font-medium transition-colors ${
                      activo ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-800 hover:bg-gray-200"
                    }`}
                  >
                    {nombre.slice(0, 3)}
                  </button>
                );
              })}
            </div>
            <div className="mt-4 flex justify-between border-t border-gray-100 pt-3">
              <button
                type="button"
                onClick={() => setPickerOpen(false)}
                className="text-sm font-medium text-gray-500 hover:text-gray-700"
              >
                Cerrar
              </button>
              <button
                type="button"
                onClick={esteMes}
                className="text-sm font-medium text-blue-600 hover:text-blue-800"
              >
                Este mes
              </button>
            </div>
          </div>
        )}

        <div className="relative">
          <button
            type="button"
            onClick={() => {
              setSaldoPopoverOpen((o) => !o);
              setSaldoAnteriorInput(
                config.saldoAnterior != null
                  ? config.saldoAnterior.toLocaleString("es-AR", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })
                  : ""
              );
            }}
            className="flex items-center gap-2 bg-green-100 hover:bg-green-200 text-green-800 text-sm px-4 py-2 rounded-lg border border-green-300"
          >
            <DollarSign className="w-4 h-4" />
            Saldo Anterior: {formatearImporteAR(config.saldoAnterior ?? 0)}
          </button>
          {saldoPopoverOpen && (
            <div className="absolute left-0 top-full z-50 mt-1 w-56 rounded-lg border bg-white p-4 shadow-lg">
              <label className="text-sm font-medium text-gray-700 block mb-1">
                Saldo Anterior
              </label>
              <Input
                value={saldoAnteriorInput}
                onChange={(e) => setSaldoAnteriorInput(e.target.value)}
                placeholder="Ej: 125.000,00"
                className="mb-2"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setSaldoPopoverOpen(false)}
                  className="text-sm text-gray-500"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={guardarSaldoAnterior}
                  className="text-sm bg-green-600 text-white px-3 py-1 rounded"
                >
                  Guardar
                </button>
              </div>
            </div>
          )}
        </div>

        <MultiCodigoInput
          codigos={config.codigosOperativos}
          onCodigosChange={(codigos) => setConfig((c) => ({ ...c, codigosOperativos: codigos }))}
          onSave={guardarCodigos}
          placeholder="Agregar código..."
        />

        <button
          type="button"
          onClick={actualizarIngresos}
          disabled={config.codigosOperativos.length === 0 || cargandoActualizar}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm px-4 py-2 rounded-lg"
        >
          <RefreshCw className={`w-4 h-4 ${cargandoActualizar ? "animate-spin" : ""}`} />
          {cargandoActualizar ? "Actualizando…" : "Actualizar Ingresos"}
        </button>

        <button
          type="button"
          onClick={() => setModalGasto(true)}
          className="flex items-center gap-2 bg-red-500 hover:bg-red-600 text-white text-sm px-4 py-2 rounded-lg"
        >
          <MinusCircle className="w-4 h-4" />
          Gastos
        </button>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <CardTitle>Movimientos</CardTitle>
            {saldoTotal > 0 && (
              <span className="text-green-700 font-semibold text-xl">
                Saldo Total: $ {formatearImporteAR(saldoTotal)}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-2.5 top-2.5 text-gray-400" />
              <Input
                placeholder="Buscar..."
                value={buscar}
                onChange={(e) => setBuscar(e.target.value)}
                className="pl-8 w-48"
              />
            </div>
            <input
              ref={inputImportarRef}
              type="file"
              accept=".csv,.xls,.xlsx,.txt"
              className="hidden"
              onChange={handleImportar}
            />
            <button
              type="button"
              onClick={() => inputImportarRef.current?.click()}
              disabled={importando}
              className="flex items-center gap-2 bg-green-600 hover:bg-green-700 disabled:opacity-70 text-white text-sm px-4 py-2 rounded-lg"
            >
              <Upload className="w-4 h-4" />
              {importando ? "Importando…" : "Importar"}
            </button>
            <div className="relative">
              <button
                type="button"
                onClick={() => setMenuExportarOpen((o) => !o)}
                className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white text-sm px-4 py-2 rounded-lg"
              >
                <Download className="w-4 h-4" />
                Exportar
                <ChevronDown className="w-3 h-3" />
              </button>
              {menuExportarOpen && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    aria-hidden
                    onClick={() => setMenuExportarOpen(false)}
                  />
                  <div className="absolute right-0 top-full mt-1 bg-white border rounded-lg shadow-lg z-20 min-w-[160px] py-1">
                    <button
                      type="button"
                      onClick={() => exportar("xlsx")}
                      className="flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-gray-50 w-full text-left"
                    >
                      <Download className="w-4 h-4 text-green-600" />
                      Excel (.xlsx)
                    </button>
                    <button
                      type="button"
                      onClick={() => exportar("pdf")}
                      className="flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-gray-50 w-full text-left border-t"
                    >
                      <FileText className="w-4 h-4 text-red-600" />
                      PDF
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-gray-600">
                  <th className="pb-2 pt-2 pl-2">Fecha</th>
                  <th className="pb-2 pt-2">Concepto</th>
                  <th className="pb-2 pt-2 text-right">Importe</th>
                  <th className="pb-2 pt-2 text-right">Saldo</th>
                  <th className="pb-2 pt-2 text-right pr-2">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {config?.saldoAnterior != null && Number(config.saldoAnterior) !== 0 && (
                  <tr className="border-b bg-gray-50">
                    <td className="py-3 pl-2 text-gray-400 italic">—</td>
                    <td className="py-3 font-medium text-gray-700">Saldo Anterior</td>
                    <td className="py-3 text-right font-medium text-green-600">
                      {formatearImporteAR(config.saldoAnterior)}
                    </td>
                    <td className="py-3 text-right text-gray-500">
                      {formatearImporteAR(config.saldoAnterior)}
                    </td>
                    <td className="py-3 pr-2" />
                  </tr>
                )}
                {loading ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-gray-400">
                      Cargando…
                    </td>
                  </tr>
                ) : movimientos.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-gray-500">
                      No hay movimientos para este período.
                    </td>
                  </tr>
                ) : (
                  movimientos.map((mov) => (
                    <tr key={mov.id} className="border-b hover:bg-gray-50">
                      <td className="py-3 pl-2 whitespace-nowrap">
                        {formatFecha(mov.fecha)}
                      </td>
                      <td className="py-3 max-w-[280px] truncate" title={mov.concepto}>
                        {mov.concepto}
                      </td>
                      <td
                        className={`py-3 text-right font-medium whitespace-nowrap ${
                          mov.importePesos >= 0 ? "text-green-600" : "text-red-600"
                        }`}
                      >
                        {formatearImporteAR(mov.importePesos)}
                      </td>
                      <td className="py-3 text-right text-gray-700 whitespace-nowrap">
                        {formatearImporteAR(mov.saldoPesos)}
                      </td>
                      <td className="py-3 text-right pr-2">
                        <div className="flex justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              setMovimientoEditar(mov);
                              setModalEditar(true);
                            }}
                            className="text-gray-400 hover:text-blue-600 p-1"
                            title="Editar"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => eliminarMovimiento(mov)}
                            className="text-gray-400 hover:text-red-600 p-1"
                            title="Eliminar"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <ModalGasto
        open={modalGasto}
        onOpenChange={setModalGasto}
        mes={mes}
        anio={anio}
        onSuccess={fetchMovimientos}
        showMessage={showMessage}
      />
      <ModalEditarMovimiento
        open={modalEditar}
        onOpenChange={setModalEditar}
        movimiento={movimientoEditar}
        onSuccess={fetchMovimientos}
        showMessage={showMessage}
      />
    </div>
  );
}
