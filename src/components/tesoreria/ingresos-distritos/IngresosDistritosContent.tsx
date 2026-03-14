"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Calendar,
  Pencil,
  Plus,
  X,
  Search,
  Upload,
  Download,
  ChevronDown,
  Trash2,
  FileText,
  RefreshCw,
} from "lucide-react";
import { formatearImporteAR } from "@/lib/parsearExtracto";
import { MultiCodigoInput } from "../MultiCodigoInput";
import { ModalEditarIngresoDistrito } from "./ModalEditarIngresoDistrito";
import { ModalImportarIngresosDistritos } from "./ModalImportarIngresosDistritos";
import type { IngresoDistrito } from "@/types/ingresos-distritos";
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

type ConfigIngreso = {
  mes: number;
  anio: number;
  codigosOperativos: string[];
};

export function IngresosDistritosContent() {
  const hoy = new Date();
  const [mes, setMes] = useState(hoy.getMonth() + 1);
  const [anio, setAnio] = useState(hoy.getFullYear());
  const [registros, setRegistros] = useState<IngresoDistrito[]>([]);
  const [config, setConfig] = useState<ConfigIngreso>({
    mes: 0,
    anio: 0,
    codigosOperativos: [],
  });
  const [loading, setLoading] = useState(true);
  const [mensaje, setMensaje] = useState<{ tipo: "ok" | "error"; text: string } | null>(null);
  const [modalEditar, setModalEditar] = useState(false);
  const [registroEditar, setRegistroEditar] = useState<IngresoDistrito | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [añoPicker, setAñoPicker] = useState(anio);
  const pickerRef = useRef<HTMLDivElement>(null);
  const [menuExportarOpen, setMenuExportarOpen] = useState(false);
  const [buscar, setBuscar] = useState("");
  const [modalImportarOpen, setModalImportarOpen] = useState(false);
  const [cargandoActualizar, setCargandoActualizar] = useState(false);

  const fetchRegistros = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ mes: String(mes), anio: String(anio) });
      if (config.codigosOperativos.length > 0) {
        params.set("codigos", config.codigosOperativos.join(","));
      }
      if (buscar) params.set("buscar", buscar);
      const res = await fetch(`/api/tesoreria/ingresos-distritos?${params}`);
      const data = await res.json();
      if (res.ok) setRegistros(Array.isArray(data) ? data : []);
      else setRegistros([]);
    } catch {
      setRegistros([]);
    } finally {
      setLoading(false);
    }
  }, [mes, anio, config.codigosOperativos, buscar]);

  const fetchConfig = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/tesoreria/ingresos-distritos/config?mes=${mes}&anio=${anio}`
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
    fetchRegistros();
  }, [fetchRegistros]);

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
  const saldoTotal = registros.length > 0 ? registros[registros.length - 1].saldo : 0;

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

  const handleActualizarIngresos = async () => {
    if (config.codigosOperativos.length === 0) {
      showMessage("error", "Agregá al menos un código para actualizar.");
      return;
    }
    setCargandoActualizar(true);
    try {
      const res = await fetch("/api/tesoreria/ingresos-distritos/actualizar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mes,
          anio,
          codigos: config.codigosOperativos,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        const created = data.created ?? 0;
        const updated = data.updated ?? 0;
        showMessage(
          "ok",
          `Actualizado: ${created} nuevos, ${updated} actualizados.`
        );
        fetchRegistros();
      } else {
        showMessage("error", data.error || "Error al actualizar ingresos.");
      }
    } catch {
      showMessage("error", "Error de conexión");
    } finally {
      setCargandoActualizar(false);
    }
  };

  const guardarCodigos = async (codigos: string[]) => {
    try {
      const res = await fetch("/api/tesoreria/ingresos-distritos/config", {
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

  const eliminarRegistro = (reg: IngresoDistrito) => {
    if (!confirm("¿Eliminar este registro?")) return;
    fetch(`/api/tesoreria/ingresos-distritos/${reg.id}`, { method: "DELETE" })
      .then((res) => {
        if (res.ok) {
          showMessage("ok", "Registro eliminado.");
          fetchRegistros();
        } else {
          res.json().then((d) => showMessage("error", d.error || "Error al eliminar"));
        }
      })
      .catch(() => showMessage("error", "Error de conexión"));
  };

  const exportar = async (formato: "xlsx" | "pdf") => {
    try {
      const params = new URLSearchParams({ mes: String(mes), anio: String(anio) });
      if (config.codigosOperativos.length > 0) {
        params.set("codigos", config.codigosOperativos.join(","));
      }
      const res = await fetch(`/api/tesoreria/ingresos-distritos/exportar?${params}`);
      const data = await res.json();

      if (!res.ok) {
        showMessage("error", data?.error || "Error al exportar");
        return;
      }

      const movs = data.movimientos ?? [];
      const nombreMesAnio = `IngresosDistritos_${nombreMes}_${anio}`;

      if (formato === "xlsx") {
        const numFormat = "#,##0.00";
        const filas: (string | number)[][] = [
          ["Mes y Año:", `${nombreMes} ${data.anio}`],
          ["PLANILLA DE RECAUDACION DTOS."],
          [],
          ["FECHA", "RECIBO Nº", "DISTRITO", "CONCEPTO", "CTA. COLEG.", "N. MATRICULADOS", "IMPORTE", "SALDO"],
          ...movs.map((m: { fecha: string; recibo: string; distrito: string; concepto: string; ctaColeg: number | null; nMatriculados: number | null; importe: number; saldo: number }) => [
            m.fecha,
            m.recibo ?? "",
            m.distrito ?? "",
            m.concepto,
            m.ctaColeg ?? "",
            m.nMatriculados ?? "",
            m.importe,
            m.saldo,
          ]),
          [],
          ["TOTAL", "", "", "", data.totalCtaColeg ?? 0, data.totalNMatriculados ?? 0, data.totalImporte ?? 0, ""],
        ];
        const ws = XLSX.utils.aoa_to_sheet(filas);
        const firstDataRow = 4;
        const lastDataRow = 3 + movs.length;
        for (let r = firstDataRow; r <= lastDataRow; r++) {
          for (const c of [4, 5, 6, 7]) {
            const cell = ws[XLSX.utils.encode_cell({ r, c })];
            if (cell && cell.t === "n") cell.z = numFormat;
          }
        }
        const totalRow = 5 + movs.length;
        for (const c of [4, 5, 6]) {
          const cell = ws[XLSX.utils.encode_cell({ r: totalRow, c })];
          if (cell && cell.t === "n") cell.z = numFormat;
        }
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Ingresos Distritos");
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
        const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
        doc.setFontSize(14);
        doc.text(
          `Ingresos Distritos - ${nombreMes} ${data.anio}${(data.codigosUsados ?? []).length > 0 ? ` (${(data.codigosUsados as string[]).join(", ")})` : ""}`,
          14,
          20
        );
        doc.setFontSize(10);
        const tableData = movs.map(
          (m: { fecha: string; recibo: string; distrito: string; concepto: string; ctaColegFormato: string; nMatriculadosFormato: string; importeFormato: string; saldoFormato: string }) => [
            m.fecha,
            m.recibo ?? "",
            m.distrito ?? "",
            m.concepto,
            m.ctaColegFormato ?? "",
            m.nMatriculadosFormato ?? "",
            m.importeFormato,
            m.saldoFormato,
          ]
        );
        autoTable(doc, {
          startY: 28,
          head: [["FECHA", "RECIBO Nº", "DISTRITO", "CONCEPTO", "CTA. COLEG.", "N. MAT.", "IMPORTE", "SALDO"]],
          body: tableData,
          theme: "grid",
        });
        const finalY = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable?.finalY ?? 28;
        doc.text(
          `Totales - Cta. Coleg: ${data.totalCtaColegFormato ?? "0,00"} | N. Mat.: ${data.totalNMatriculadosFormato ?? "0,00"} | Importe: ${data.totalImporteFormato ?? "0,00"} | Saldo: ${data.saldoFinalFormato ?? "0,00"}`,
          14,
          finalY + 8
        );
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

        <MultiCodigoInput
          codigos={config.codigosOperativos}
          onCodigosChange={(codigos) => setConfig((c) => ({ ...c, codigosOperativos: codigos }))}
          onSave={guardarCodigos}
          placeholder="Agregar código..."
        />

        <Button
          type="button"
          onClick={handleActualizarIngresos}
          disabled={config.codigosOperativos.length === 0 || cargandoActualizar}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm px-4 py-2 rounded-lg"
        >
          <RefreshCw className={`w-4 h-4 ${cargandoActualizar ? "animate-spin" : ""}`} />
          {cargandoActualizar ? "Actualizando…" : "Actualizar Ingresos"}
        </Button>

        <Button
          type="button"
          onClick={() => {
            setRegistroEditar(null);
            setModalEditar(true);
          }}
          className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white text-sm px-4 py-2 rounded-lg"
        >
          <Plus className="w-4 h-4" />
          Nuevo
        </Button>

        <Button
          type="button"
          variant="outline"
          onClick={() => setModalImportarOpen(true)}
          className="flex items-center gap-2 text-sm px-4 py-2 rounded-lg"
        >
          <Upload className="w-4 h-4" />
          Importar
        </Button>

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

      <Card>
        <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-4 mb-4">
          <div className="flex items-center gap-4">
            <span className="font-semibold text-lg">Planilla</span>
            <span className="text-green-700 font-semibold text-xl">
              Saldo Total: $ {formatearImporteAR(saldoTotal)}
            </span>
          </div>
          <div className="relative">
            <Search className="w-4 h-4 absolute left-2.5 top-2.5 text-gray-400" />
            <Input
              placeholder="Buscar..."
              value={buscar}
              onChange={(e) => setBuscar(e.target.value)}
              className="pl-8 w-48"
            />
          </div>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-gray-600">
                  <th className="pb-2 pt-2 pl-2">Fecha</th>
                  <th className="pb-2 pt-2">Recibo Nº</th>
                  <th className="pb-2 pt-2">Distrito</th>
                  <th className="pb-2 pt-2">Concepto</th>
                  <th className="pb-2 pt-2 text-right">Cta. Coleg.</th>
                  <th className="pb-2 pt-2 text-right">N. Matriculados</th>
                  <th className="pb-2 pt-2 text-right">Importe</th>
                  <th className="pb-2 pt-2 text-right">Saldo</th>
                  <th className="pb-2 pt-2 text-right pr-2">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-gray-400">
                      Cargando…
                    </td>
                  </tr>
                ) : registros.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-gray-500">
                      No hay registros para este período.
                    </td>
                  </tr>
                ) : (
                  registros.map((reg) => (
                    <tr key={reg.id} className="border-b hover:bg-gray-50">
                      <td className="py-3 pl-2 whitespace-nowrap">{formatFecha(reg.fecha)}</td>
                      <td className="py-3">{reg.recibo ?? "—"}</td>
                      <td className="py-3">{reg.distrito ?? "—"}</td>
                      <td className="py-3 max-w-[220px] truncate" title={reg.concepto}>
                        {reg.concepto}
                      </td>
                      <td className="py-3 text-right whitespace-nowrap text-gray-700">
                        {reg.ctaColeg != null ? `$ ${formatearImporteAR(reg.ctaColeg)}` : "—"}
                      </td>
                      <td className="py-3 text-right whitespace-nowrap text-gray-700">
                        {reg.nMatriculados != null ? `$ ${formatearImporteAR(reg.nMatriculados)}` : "—"}
                      </td>
                      <td className="py-3 text-right font-medium whitespace-nowrap text-green-700">
                        $ {formatearImporteAR(reg.importe)}
                      </td>
                      <td className="py-3 text-right whitespace-nowrap text-gray-700">
                        $ {formatearImporteAR(reg.saldo)}
                      </td>
                      <td className="py-3 text-right pr-2">
                        <div className="flex justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              setRegistroEditar(reg);
                              setModalEditar(true);
                            }}
                            className="text-gray-400 hover:text-blue-600 p-1"
                            title="Editar"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => eliminarRegistro(reg)}
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

      <ModalEditarIngresoDistrito
        open={modalEditar}
        onOpenChange={setModalEditar}
        registro={registroEditar}
        mes={mes}
        anio={anio}
        codigos={config.codigosOperativos}
        onSuccess={fetchRegistros}
        showMessage={showMessage}
      />

      <ModalImportarIngresosDistritos
        open={modalImportarOpen}
        onOpenChange={setModalImportarOpen}
        mes={mes}
        anio={anio}
        codigos={config.codigosOperativos}
        onSuccess={fetchRegistros}
        showMessage={showMessage}
      />
    </div>
  );
}
