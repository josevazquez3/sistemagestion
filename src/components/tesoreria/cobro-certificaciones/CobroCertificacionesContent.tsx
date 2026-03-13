"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Calendar,
  Hash,
  Pencil,
  Plus,
  X,
  RefreshCw,
  Search,
  Upload,
  Download,
  ChevronDown,
  Trash2,
  FileText,
  Percent,
} from "lucide-react";
import { formatearImporteAR, parsearArchivoExtracto } from "@/lib/parsearExtracto";
import { parsearExcelGenerico, type MovimientoImportado } from "@/lib/tesoreria/parsearImportFlex";
import { ModalEditarMovimiento, type MovimientoCobroCertificacion } from "./ModalEditarMovimiento";
import { ModalComisiones } from "./ModalComisiones";
import * as XLSX from "xlsx";
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

type ConfigCobro = {
  mes: number;
  anio: number;
  codigosOperativos: string[];
};

export function CobroCertificacionesContent() {
  const hoy = new Date();
  const [mes, setMes] = useState(hoy.getMonth() + 1);
  const [anio, setAnio] = useState(hoy.getFullYear());
  const [movimientos, setMovimientos] = useState<MovimientoCobroCertificacion[]>([]);
  const [config, setConfig] = useState<ConfigCobro>({
    mes: 0,
    anio: 0,
    codigosOperativos: [],
  });
  const [loading, setLoading] = useState(true);
  const [mensaje, setMensaje] = useState<{ tipo: "ok" | "error"; text: string } | null>(null);
  const [modalEditar, setModalEditar] = useState(false);
  const [movimientoEditar, setMovimientoEditar] = useState<MovimientoCobroCertificacion | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [añoPicker, setAñoPicker] = useState(anio);
  const pickerRef = useRef<HTMLDivElement>(null);
  const [nuevoCodigoInput, setNuevoCodigoInput] = useState("");
  const [menuExportarOpen, setMenuExportarOpen] = useState(false);
  const [buscar, setBuscar] = useState("");
  const [cargandoActualizar, setCargandoActualizar] = useState(false);
  const [importando, setImportando] = useState(false);
  const inputImportarRef = useRef<HTMLInputElement>(null);
  const [modalComisionesOpen, setModalComisionesOpen] = useState(false);
  const [movimientosPreview, setMovimientosPreview] = useState<MovimientoImportado[]>([]);
  const [modalPreviewImportar, setModalPreviewImportar] = useState(false);

  const fetchMovimientos = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ mes: String(mes), anio: String(anio) });
      if (buscar) params.set("buscar", buscar);
      const res = await fetch(`/api/tesoreria/cobro-certificaciones?${params}`);
      const data = await res.json();
      if (res.ok) setMovimientos(Array.isArray(data) ? data : []);
    } catch {
      setMovimientos([]);
    } finally {
      setLoading(false);
    }
  }, [mes, anio, buscar]);

  const fetchConfig = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/tesoreria/cobro-certificaciones/config?mes=${mes}&anio=${anio}`
      );
      const data = await res.json();
      if (res.ok)
        setConfig({
          mes: data.mes ?? mes,
          anio: data.anio ?? anio,
          codigosOperativos: Array.isArray(data.codigosOperativos) ? data.codigosOperativos : [],
        });
    } catch {
      setConfig((c) => ({ ...c, codigosOperativos: [] }));
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

  const guardarCodigos = async (codigos: string[]) => {
    try {
      const res = await fetch("/api/tesoreria/cobro-certificaciones/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mes, anio, codigosOperativos: codigos }),
      });
      if (res.ok) {
        setConfig((c) => ({ ...c, codigosOperativos: codigos }));
        fetchConfig();
        showMessage("ok", "Códigos actualizados.");
      } else {
        const data = await res.json();
        showMessage("error", data.error || "Error al guardar");
      }
    } catch {
      showMessage("error", "Error de conexión");
    }
  };

  const agregarCodigo = () => {
    const cod = nuevoCodigoInput.trim();
    if (!cod) return;
    if (config.codigosOperativos.includes(cod)) {
      showMessage("error", "Ese código ya está agregado.");
      return;
    }
    const next = [...config.codigosOperativos, cod];
    setNuevoCodigoInput("");
    guardarCodigos(next);
  };

  const quitarCodigo = (cod: string) => {
    const next = config.codigosOperativos.filter((c) => c !== cod);
    guardarCodigos(next);
  };

  const actualizarCobros = async () => {
    if (config.codigosOperativos.length === 0) {
      showMessage("error", "Agregá al menos un código operativo.");
      return;
    }
    setCargandoActualizar(true);
    try {
      const res = await fetch("/api/tesoreria/cobro-certificaciones/actualizar-cobros", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mes, anio }),
      });
      const data = await res.json();
      if (res.ok) {
        const n = data.importados ?? 0;
        if (n > 0) showMessage("ok", `${n} cobro(s) importados.`);
        else showMessage("ok", "No se encontraron movimientos para ese período y código operativo.");
        fetchMovimientos();
      } else {
        showMessage("error", data.error || "Error al actualizar cobros.");
      }
    } catch {
      showMessage("error", "Error de conexión");
    } finally {
      setCargandoActualizar(false);
    }
  };

  const eliminarMovimiento = (mov: MovimientoCobroCertificacion) => {
    if (!confirm("¿Eliminar este movimiento?")) return;
    fetch(`/api/tesoreria/cobro-certificaciones/${mov.id}`, { method: "DELETE" })
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

  const saldoTotal = movimientos.length > 0 ? movimientos[movimientos.length - 1].saldo : 0;

  const exportar = async (formato: "xlsx" | "pdf") => {
    try {
      const res = await fetch(
        `/api/tesoreria/cobro-certificaciones/exportar?mes=${mes}&anio=${anio}`
      );
      const data = await res.json();

      if (!res.ok) {
        showMessage("error", data?.error || "Error al exportar");
        return;
      }

      const movs = data.movimientos ?? [];
      const nombreMesAnio = `CobroCertificaciones_${nombreMes}_${anio}`;

      if (formato === "xlsx") {
        type MovExport = {
          fecha: string;
          concepto: string;
          importe: number;
          saldo: number;
        };
        const filas: (string | number)[][] = [
          [data.titulo],
          [],
          ["Fecha", "Concepto", "Importe", "Saldo"],
          ...(movs as MovExport[]).map((m) => [m.fecha, m.concepto, m.importe, m.saldo]),
          [],
          ["Total ingresos", "", ""],
        ];
        const ws = XLSX.utils.aoa_to_sheet(filas);
        const numFormat = "#,##0.00";
        const firstDataRow = 4;
        const lastDataRow = 3 + movs.length;
        const totalRow = 5 + movs.length;
        for (let r = firstDataRow; r <= lastDataRow; r++) {
          const cCell = ws[XLSX.utils.encode_cell({ r: r - 1, c: 2 })];
          const dCell = ws[XLSX.utils.encode_cell({ r: r - 1, c: 3 })];
          if (cCell && cCell.t === "n") cCell.z = numFormat;
          if (dCell && dCell.t === "n") dCell.z = numFormat;
        }
        const totalImporteRef = XLSX.utils.encode_cell({ r: totalRow - 1, c: 2 });
        ws[totalImporteRef] = {
          t: "n",
          f: `SUM(C${firstDataRow}:C${lastDataRow})`,
          z: numFormat,
        };
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Cobro Certificaciones");
        const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
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
        doc.text(data.titulo ?? `Cobro Certificaciones - ${nombreMes} ${anio}`, 14, 20);
        doc.setFontSize(10);
        const tableData = movs.map(
          (m: { fecha: string; concepto: string; importeFormato: string; saldoFormato: string }) => [
            m.fecha,
            m.concepto,
            m.importeFormato,
            m.saldoFormato,
          ]
        );
        autoTable(doc, {
          startY: 28,
          head: [["Fecha", "Concepto", "Importe", "Saldo"]],
          body: tableData,
          theme: "grid",
        });
        const finalY = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable?.finalY ?? 28;
        doc.text(`Total ingresos: ${data.totalIngresosFormato ?? "0,00"}`, 14, finalY + 8);
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
    } catch {
      showMessage("error", "Error al exportar. Intentá de nuevo.");
    } finally {
      setMenuExportarOpen(false);
    }
  };

  const handleImportar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setImportando(true);

    try {
      const extension = file.name.split(".").pop()?.toLowerCase();
      let movimientosParsados: MovimientoImportado[] = [];

      if (extension === "xls" || extension === "xlsx") {
        const buffer = await file.arrayBuffer();
        const wb = XLSX.read(buffer, { type: "array", cellDates: false });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const filas: unknown[][] = XLSX.utils.sheet_to_json(ws, {
          header: 1,
          defval: null,
        });
        movimientosParsados = parsearExcelGenerico(filas);

        if (movimientosParsados.length === 0) {
          showMessage(
            "error",
            "No se encontraron movimientos válidos. Verificá que el archivo tenga columnas Fecha, Concepto e Importe (o Entrada/Salida)."
          );
          return;
        }
      } else if (extension === "csv" || extension === "txt") {
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
          importePesos: Math.abs(Number(m.importePesos) || 0),
          tipo: "INGRESO" as const,
        }));
      } else {
        showMessage("error", "Solo se permiten archivos .csv, .xls, .xlsx o .txt.");
        return;
      }

      if (movimientosParsados.length === 0) {
        showMessage("error", "No se encontraron movimientos válidos en el archivo.");
        return;
      }

      setMovimientosPreview(movimientosParsados);
      setModalPreviewImportar(true);
    } catch (err) {
      console.error("Error al importar:", err);
      showMessage("error", "Error al importar el archivo. Verificá el formato.");
    } finally {
      setImportando(false);
    }
  };

  const confirmarImportacion = useCallback(async () => {
    setModalPreviewImportar(false);
    let importados = 0;
    for (const m of movimientosPreview) {
      try {
        const res = await fetch("/api/tesoreria/cobro-certificaciones", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fecha: m.fecha.toISOString(),
            concepto: m.concepto,
            importePesos: Math.abs(m.importePesos),
            mes,
            anio,
          }),
        });
        if (res.ok) importados++;
      } catch {
        // ignorar error por fila
      }
    }
    showMessage("ok", `Se importaron ${importados} movimiento(s) correctamente.`);
    fetchMovimientos();
  }, [movimientosPreview, mes, anio, fetchMovimientos]);

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

        <div className="flex items-center gap-2 flex-wrap">
          {config.codigosOperativos.map((cod) => (
            <span
              key={cod}
              className="inline-flex items-center gap-1 bg-slate-100 text-slate-700 text-sm px-3 py-1.5 rounded-lg border border-slate-300"
            >
              <Hash className="w-3.5 h-3.5 text-slate-500" />
              {cod}
              <button
                type="button"
                onClick={() => quitarCodigo(cod)}
                className="text-slate-400 hover:text-red-600 p-0.5 rounded"
                title="Quitar código"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </span>
          ))}
          <div className="flex items-center gap-1">
            <input
              value={nuevoCodigoInput}
              onChange={(e) => setNuevoCodigoInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), agregarCodigo())}
              placeholder="Agregar código..."
              className="border rounded px-2 py-1.5 text-sm w-36"
            />
            <button
              type="button"
              onClick={agregarCodigo}
              className="flex items-center gap-1 bg-green-600 hover:bg-green-700 text-white text-sm px-2 py-1.5 rounded"
              title="Agregar código"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={actualizarCobros}
          disabled={config.codigosOperativos.length === 0 || cargandoActualizar}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm px-4 py-2 rounded-lg"
        >
          <RefreshCw className={`w-4 h-4 ${cargandoActualizar ? "animate-spin" : ""}`} />
          {cargandoActualizar ? "Actualizando…" : "Actualizar Cobros"}
        </button>

        <button
          type="button"
          onClick={() => setModalComisionesOpen(true)}
          className="flex items-center gap-2 bg-cyan-500 hover:bg-cyan-600 text-white text-sm px-4 py-2 rounded-lg"
        >
          <Percent className="w-4 h-4" />
          Comisiones
        </button>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-4 mb-4">
          <div className="flex items-center gap-4">
            <span className="font-semibold text-lg">Movimientos</span>
            <span className="text-green-700 font-semibold text-xl">
              Saldo Total: $ {formatearImporteAR(saldoTotal)}
            </span>
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
                          mov.importe >= 0 ? "text-green-600" : "text-red-600"
                        }`}
                      >
                        {formatearImporteAR(mov.importe)}
                      </td>
                      <td className="py-3 text-right text-gray-700 whitespace-nowrap">
                        {formatearImporteAR(mov.saldo)}
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

      <ModalEditarMovimiento
        open={modalEditar}
        onOpenChange={setModalEditar}
        movimiento={movimientoEditar}
        onSuccess={fetchMovimientos}
        showMessage={showMessage}
      />

      <ModalComisiones
        isOpen={modalComisionesOpen}
        onClose={() => setModalComisionesOpen(false)}
        mes={mes}
        anio={anio}
        movimientos={movimientos}
        showMessage={showMessage}
      />

      {modalPreviewImportar && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[80vh] flex flex-col shadow-xl">
            <h3 className="font-semibold text-lg mb-1">Vista previa importación</h3>
            <p className="text-sm text-gray-500 mb-3">
              {movimientosPreview.length} movimiento(s) detectados. Revisá antes de confirmar.
            </p>
            <div className="overflow-y-auto flex-1">
              <table className="w-full text-sm border-collapse">
                <thead className="sticky top-0 bg-white">
                  <tr className="border-b text-left text-gray-600">
                    <th className="pb-2 pr-4">Fecha</th>
                    <th className="pb-2 pr-4">Concepto</th>
                    <th className="pb-2 text-right pr-4">Importe</th>
                    <th className="pb-2 text-right">Tipo</th>
                  </tr>
                </thead>
                <tbody>
                  {movimientosPreview.map((m, i) => (
                    <tr key={i} className="border-b hover:bg-gray-50">
                      <td className="py-2 pr-4">
                        {m.fecha.toLocaleDateString("es-AR", {
                          timeZone: "America/Argentina/Buenos_Aires",
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                        })}
                      </td>
                      <td className="py-2 pr-4 max-w-xs truncate">{m.concepto}</td>
                      <td
                        className={`py-2 pr-4 text-right font-medium ${
                          m.importePesos >= 0 ? "text-green-600" : "text-red-600"
                        }`}
                      >
                        {formatearImporteAR(m.importePesos)}
                      </td>
                      <td className="py-2 text-right">
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full ${
                            m.tipo === "INGRESO"
                              ? "bg-green-100 text-green-700"
                              : "bg-red-100 text-red-700"
                          }`}
                        >
                          {m.tipo}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex justify-end gap-2 mt-4 pt-3 border-t">
              <button
                type="button"
                onClick={() => setModalPreviewImportar(false)}
                className="px-4 py-2 border rounded text-sm hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmarImportacion}
                className="px-4 py-2 bg-green-600 text-white rounded text-sm hover:bg-green-700"
              >
                Confirmar importación ({movimientosPreview.length})
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
