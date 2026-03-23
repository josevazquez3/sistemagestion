"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import {
  Calendar,
  CheckCircle2,
  FileSpreadsheet,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { InputFecha } from "@/components/ui/InputFecha";
import { Label } from "@/components/ui/label";
import { parsearImporteAR } from "@/lib/parsearExtracto";

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

type Proveedor = {
  id: number;
  proveedor: string;
  nombreContacto: string | null;
  alias: string | null;
  cuit: string | null;
  cuentaDebitoTipoNum: string | null;
  banco: string | null;
  direccion: string | null;
  ciudad: string | null;
  telefono: string | null;
  email: string | null;
  formaPago: string | null;
  cbu: string | null;
};

type Factura = {
  id: number;
  mes: number;
  anio: number;
  proveedorId: number;
  proveedor: Proveedor;
  puntoVenta: number;
  nroFactura: number;
  cuit: string;
  fecha: string;
  descripcion: string;
  tipoComprobante: string;
  importe: number;
};
interface FacturaConProveedor extends Factura {
  proveedor: Proveedor;
}

type FacturaForm = {
  proveedorId: number | null;
  cuit: string;
  puntoVenta: string;
  nroFactura: string;
  fecha: string;
  descripcion: string;
  tipoComprobante: string;
  importeStr: string;
};

type Toast = { tipo: "ok" | "error"; text: string } | null;

const formVacio: FacturaForm = {
  proveedorId: null,
  cuit: "",
  puntoVenta: "",
  nroFactura: "",
  fecha: "",
  descripcion: "",
  tipoComprobante: "A",
  importeStr: "",
};

function formatCurrencyInput(raw: string) {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  const value = Number(digits) / 100;
  return value.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function parseDateDisplay(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("es-AR", { timeZone: "America/Argentina/Buenos_Aires" });
}

function toDateInputAR(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

function excelSafeSheetName(name: string) {
  const clean = name.replace(/[\\/?*\[\]:]/g, " ").trim();
  return (clean || "Proveedor").slice(0, 31);
}

function formatearFecha(fecha: Date | string): string {
  const d = new Date(fecha);
  const dia = String(d.getUTCDate()).padStart(2, "0");
  const mes = String(d.getUTCMonth() + 1).padStart(2, "0");
  const anio = d.getUTCFullYear();
  return `${dia}/${mes}/${anio}`;
}

export function FacturasProveedoresContent() {
  const now = new Date();
  const [mes, setMes] = useState(now.getMonth() + 1);
  const [anio, setAnio] = useState(now.getFullYear());
  const [añoPicker, setAñoPicker] = useState(anio);
  const [pickerOpen, setPickerOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  const [facturas, setFacturas] = useState<FacturaConProveedor[]>([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<Toast>(null);
  const [saldoBancario, setSaldoBancario] = useState<number>(0);

  const [openModal, setOpenModal] = useState(false);
  const [editing, setEditing] = useState<Factura | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<FacturaForm>(formVacio);

  const [searchProveedorOpen, setSearchProveedorOpen] = useState(false);
  const [searchProveedor, setSearchProveedor] = useState("");
  const [searchingProveedor, setSearchingProveedor] = useState(false);
  const [resultadosProveedor, setResultadosProveedor] = useState<Proveedor[]>([]);
  const [proveedorSeleccionado, setProveedorSeleccionado] = useState<Proveedor | null>(null);

  const nombreMes = MESES[mes - 1];

  const totalImportes = useMemo(
    () => facturas.reduce((acc, f) => acc + Number(f.importe || 0), 0),
    [facturas]
  );

  const fetchFacturas = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/facturas-proveedores?mes=${mes}&anio=${anio}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Error al cargar facturas.");
      setFacturas(Array.isArray(data) ? data : []);
    } catch (e) {
      setFacturas([]);
      setToast({ tipo: "error", text: e instanceof Error ? e.message : "Error al cargar facturas." });
    } finally {
      setLoading(false);
    }
  }, [mes, anio]);

  useEffect(() => {
    fetchFacturas();
  }, [fetchFacturas]);

  useEffect(() => {
    const fetchSaldoBancario = async () => {
      try {
        const res = await fetch("/api/tesoreria/saldo-bancario");
        const data = await res.json();
        if (!res.ok) return;
        setSaldoBancario(Number(data?.saldo ?? 0));
      } catch {
        setSaldoBancario(0);
      }
    };
    fetchSaldoBancario();
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setPickerOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  useEffect(() => {
    if (pickerOpen) setAñoPicker(anio);
  }, [pickerOpen, anio]);

  useEffect(() => {
    if (!openModal || !searchProveedorOpen) return;
    const t = setTimeout(async () => {
      const q = searchProveedor.trim();
      if (!q) {
        setResultadosProveedor([]);
        return;
      }
      setSearchingProveedor(true);
      try {
        const res = await fetch(`/api/proveedores?search=${encodeURIComponent(q)}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error ?? "Error de búsqueda.");
        setResultadosProveedor(Array.isArray(data) ? data : []);
      } catch {
        setResultadosProveedor([]);
      } finally {
        setSearchingProveedor(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [searchProveedor, openModal, searchProveedorOpen]);

  const seleccionarMes = (m: number) => {
    setMes(m);
    setAnio(añoPicker);
    setPickerOpen(false);
  };

  const esteMes = () => {
    const d = new Date();
    setMes(d.getMonth() + 1);
    setAnio(d.getFullYear());
    setPickerOpen(false);
  };

  const abrirCrear = () => {
    setEditing(null);
    setForm(formVacio);
    setProveedorSeleccionado(null);
    setSearchProveedor("");
    setResultadosProveedor([]);
    setSearchProveedorOpen(false);
    setOpenModal(true);
  };

  const abrirEditar = (f: Factura) => {
    setEditing(f);
    setProveedorSeleccionado(f.proveedor);
    setForm({
      proveedorId: f.proveedorId,
      cuit: f.cuit,
      puntoVenta: String(f.puntoVenta),
      nroFactura: String(f.nroFactura),
      fecha: toDateInputAR(f.fecha),
      descripcion: f.descripcion ?? "",
      tipoComprobante: f.tipoComprobante ?? "A",
      importeStr: Number(f.importe).toLocaleString("es-AR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
    });
    setOpenModal(true);
  };

  const seleccionarProveedor = (p: Proveedor) => {
    setProveedorSeleccionado(p);
    setForm((prev) => ({
      ...prev,
      proveedorId: p.id,
      cuit: p.cuit ?? "",
    }));
    setSearchProveedorOpen(false);
  };

  const guardarFactura = async () => {
    if (!form.proveedorId) {
      setToast({ tipo: "error", text: "Seleccioná un proveedor." });
      return;
    }
    if (!form.puntoVenta || !form.nroFactura || !form.cuit || !form.importeStr) {
      setToast({ tipo: "error", text: "Completá los campos obligatorios." });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        proveedorId: form.proveedorId,
        puntoVenta: Number(form.puntoVenta),
        nroFactura: Number(form.nroFactura),
        cuit: form.cuit,
        fecha: form.fecha,
        descripcion: form.descripcion,
        tipoComprobante: form.tipoComprobante,
        importe: parsearImporteAR(form.importeStr),
        mes,
        anio,
      };

      const url = editing ? `/api/facturas-proveedores/${editing.id}` : "/api/facturas-proveedores";
      const method = editing ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "No se pudo guardar.");

      if (editing) {
        setFacturas((prev) => prev.map((f) => (f.id === editing.id ? data : f)));
        setToast({ tipo: "ok", text: "Factura actualizada." });
      } else {
        setFacturas((prev) => [...prev, data]);
        setToast({ tipo: "ok", text: "Factura cargada correctamente." });
      }
      setOpenModal(false);
    } catch (e) {
      setToast({ tipo: "error", text: e instanceof Error ? e.message : "Error al guardar factura." });
    } finally {
      setSaving(false);
    }
  };

  const eliminarFactura = async (id: number) => {
    if (!confirm("¿Eliminar esta factura?")) return;
    try {
      const res = await fetch(`/api/facturas-proveedores/${id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? "No se pudo eliminar.");
      setFacturas((prev) => prev.filter((f) => f.id !== id));
      setToast({ tipo: "ok", text: "Factura eliminada." });
    } catch (e) {
      setToast({ tipo: "error", text: e instanceof Error ? e.message : "Error al eliminar." });
    }
  };

  const generarOrdenPago = () => {
    if (facturas.length === 0) return;

    const mesStr = String(mes).padStart(2, "0");
    const anioActivo = anio;
    const wb = XLSX.utils.book_new();

    const facturasPorProveedor = new Map<number, FacturaConProveedor[]>();
    for (const f of facturas) {
      if (!f.proveedor) continue;
      const grupo = facturasPorProveedor.get(f.proveedorId) ?? [];
      grupo.push(f);
      facturasPorProveedor.set(f.proveedorId, grupo);
    }

    const proyectadoData: Array<Array<string | number | { t: string; f: string } | null>> = [];
    proyectadoData.push([]);
    proyectadoData.push(["SALDO BANCARIO A LA FECHA", Number(saldoBancario)]);
    proyectadoData.push([]);
    proyectadoData.push([]);
    proyectadoData.push([]);
    proyectadoData.push([]);
    proyectadoData.push([]);
    proyectadoData.push([`GASTOS C.S. ${mesStr}/${anioActivo}`, ""]);
    proyectadoData.push([]);
    proyectadoData.push([]);

    const rowStart = proyectadoData.length + 1;
    for (const [, grupo] of facturasPorProveedor) {
      const nombre = grupo[0]?.proveedor?.proveedor ?? "Proveedor";
      const total = grupo.reduce((acc, f) => acc + Number(f.importe || 0), 0);
      proyectadoData.push([nombre, total]);
    }

    const totalRowIndex = proyectadoData.length + 1;
    proyectadoData.push([
      "Total:",
      { t: "n", f: `SUM(B${rowStart}:B${totalRowIndex - 1})` },
    ]);
    proyectadoData.push([]);
    proyectadoData.push([
      "Quedaría un saldo de $",
      { t: "n", f: `B2-B${totalRowIndex}` },
    ]);

    const wsProyectado = XLSX.utils.aoa_to_sheet(proyectadoData);
    wsProyectado["!cols"] = [{ wch: 45 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(wb, wsProyectado, "PROYECTADO GASTOS");

    for (const [, grupo] of facturasPorProveedor) {
      const wsData: Array<Array<string | number | null | { t: string; f: string }>> = [];
      wsData.push([
        "Pto. De vta.",
        "Nº de factura",
        "cuit",
        "fecha",
        "descripcion",
        "TIPO DE COMPROBANTE",
        "importe",
      ]);

      grupo.forEach((f) => {
        wsData.push([
          f.puntoVenta,
          f.nroFactura,
          f.cuit,
          formatearFecha(f.fecha),
          f.descripcion,
          f.tipoComprobante,
          Number(f.importe),
        ]);
      });

      wsData.push([
        null, null, null, null, null, null,
        { t: "n", f: `SUM(G2:G${grupo.length + 1})` },
      ]);

      wsData.push([]);
      wsData.push([]);
      wsData.push([
        "Proveedor",
        "Nombre del contacto principal",
        "ALIAS",
        "CUIT",
        "CTA. DE DEBITO (TIPO Y NUMERO)",
        "BANCO",
        "Dirección",
        "Ciudad",
        "Teléfono",
        "Correo electrónico",
        "Formas de Pago",
        "CBU",
      ]);

      const p = grupo[0]!.proveedor;
      wsData.push([
        p.proveedor ?? "",
        p.nombreContacto ?? "",
        p.alias ?? "",
        p.cuit ?? "",
        p.cuentaDebitoTipoNum ?? "",
        p.banco ?? "",
        p.direccion ?? "",
        p.ciudad ?? "",
        p.telefono ?? "",
        p.email ?? "",
        p.formaPago ?? "",
        p.cbu ?? "",
      ]);

      const wsProveedor = XLSX.utils.aoa_to_sheet(wsData);
      wsProveedor["!cols"] = [
        { wch: 30 },
        { wch: 20 },
        { wch: 18 },
        { wch: 16 },
        { wch: 35 },
        { wch: 16 },
        { wch: 14 },
        { wch: 14 },
        { wch: 18 },
        { wch: 28 },
        { wch: 16 },
        { wch: 26 },
      ];

      const sheetName = excelSafeSheetName(p.proveedor || "Proveedor");
      XLSX.utils.book_append_sheet(wb, wsProveedor, sheetName);
    }

    XLSX.writeFile(wb, `FACTURA_PROVEEDORES_${mesStr}-${anioActivo}.xlsx`);
  };

  return (
    <div className="space-y-6 mt-6">
      {toast && (
        <div
          className={`rounded-lg border px-4 py-3 text-sm ${
            toast.tipo === "ok"
              ? "border-green-200 bg-green-50 text-green-800"
              : "border-red-200 bg-red-50 text-red-800"
          }`}
        >
          {toast.text}
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
            <div className="mb-4 text-center text-xl font-semibold text-gray-800">{añoPicker}</div>
            <div className="mb-2 flex justify-center gap-2">
              <button type="button" onClick={() => setAñoPicker((a) => a - 1)} className="rounded bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-200">← Año anterior</button>
              <button type="button" onClick={() => setAñoPicker((a) => a + 1)} className="rounded bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-200">Año siguiente →</button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {MESES.map((n, i) => {
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
                    {n.slice(0, 3)}
                  </button>
                );
              })}
            </div>
            <div className="mt-4 flex justify-between border-t border-gray-100 pt-3">
              <button type="button" onClick={() => setPickerOpen(false)} className="text-sm font-medium text-gray-500 hover:text-gray-700">Cerrar</button>
              <button type="button" onClick={esteMes} className="text-sm font-medium text-blue-600 hover:text-blue-800">Este mes</button>
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button className="bg-blue-600 hover:bg-blue-700 text-white" onClick={abrirCrear}>
          <Plus className="h-4 w-4 mr-2" />
          Cargar Factura
        </Button>
        {facturas.length > 0 && (
          <Button className="bg-green-600 hover:bg-green-700 text-white" onClick={generarOrdenPago}>
            <FileSpreadsheet className="h-4 w-4 mr-2" />
            Generar Orden de Pago
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Facturas cargadas — {nombreMes} {anio}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto border rounded-lg">
            <table className="w-full text-sm min-w-[1200px]">
              <thead>
                <tr className="border-b bg-gray-50 text-left text-gray-600">
                  <th className="px-3 py-2">Proveedor</th>
                  <th className="px-3 py-2">Pto. Vta.</th>
                  <th className="px-3 py-2">N° Factura</th>
                  <th className="px-3 py-2">CUIT</th>
                  <th className="px-3 py-2">Fecha</th>
                  <th className="px-3 py-2">Descripción</th>
                  <th className="px-3 py-2">Tipo</th>
                  <th className="px-3 py-2 text-right">Importe</th>
                  <th className="px-3 py-2 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={9} className="px-3 py-8 text-center text-gray-500">Cargando...</td></tr>
                ) : facturas.length === 0 ? (
                  <tr><td colSpan={9} className="px-3 py-8 text-center text-gray-500">No hay facturas para este período.</td></tr>
                ) : (
                  facturas.map((f) => (
                    <tr key={f.id} className="border-b hover:bg-gray-50">
                      <td className="px-3 py-2">{f.proveedor.proveedor}</td>
                      <td className="px-3 py-2">{f.puntoVenta}</td>
                      <td className="px-3 py-2">{f.nroFactura}</td>
                      <td className="px-3 py-2">{f.cuit}</td>
                      <td className="px-3 py-2">{parseDateDisplay(f.fecha)}</td>
                      <td className="px-3 py-2">{f.descripcion}</td>
                      <td className="px-3 py-2">{f.tipoComprobante}</td>
                      <td className="px-3 py-2 text-right">$ {Number(f.importe).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      <td className="px-3 py-2">
                        <div className="flex justify-end gap-1">
                          <Button type="button" size="icon" variant="ghost" className="h-8 w-8" onClick={() => abrirEditar(f)} title="Editar">
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button type="button" size="icon" variant="ghost" className="h-8 w-8 text-red-700 hover:bg-red-50" onClick={() => void eliminarFactura(f.id)} title="Eliminar">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              <tfoot>
                <tr className="bg-gray-50 font-semibold">
                  <td colSpan={7} className="px-3 py-3 text-right">Total:</td>
                  <td className="px-3 py-3 text-right">$ {totalImportes.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={openModal} onOpenChange={setOpenModal}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Factura" : "Cargar Factura"}</DialogTitle>
            <DialogDescription>Completá los datos de la factura del proveedor.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2 border rounded-lg p-3">
              <Label>Proveedor</Label>
              {!proveedorSeleccionado ? (
                <>
                  <Button variant="outline" onClick={() => setSearchProveedorOpen((o) => !o)}>
                    {searchProveedorOpen ? "Ocultar buscador" : "Buscar proveedor"}
                  </Button>
                  {searchProveedorOpen && (
                    <div className="space-y-2">
                      <Input
                        value={searchProveedor}
                        onChange={(e) => setSearchProveedor(e.target.value)}
                        placeholder="Buscar por nombre, CUIT, CBU, alias, banco, contacto o email"
                      />
                      {searchingProveedor && <p className="text-sm text-gray-500">Buscando...</p>}
                      <div className="max-h-56 overflow-y-auto border rounded">
                        {resultadosProveedor.map((p) => (
                          <div key={p.id} className="px-3 py-2 border-b text-sm flex items-center justify-between gap-3">
                            <div>
                              <p className="font-medium">{p.proveedor}</p>
                              <p className="text-xs text-gray-600">
                                {p.cuit ?? "Sin CUIT"} | {p.banco ?? "Sin banco"} | {p.cbu ?? "Sin CBU"}
                              </p>
                            </div>
                            <Button size="sm" variant="outline" onClick={() => seleccionarProveedor(p)}>
                              Seleccionar
                            </Button>
                          </div>
                        ))}
                        {!searchingProveedor && resultadosProveedor.length === 0 && searchProveedor.trim() && (
                          <p className="px-3 py-3 text-sm text-gray-500">Sin resultados.</p>
                        )}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-green-800">
                    <CheckCircle2 className="h-4 w-4" />
                    <span className="font-medium">{proveedorSeleccionado.proveedor}</span>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setProveedorSeleccionado(null);
                      setForm((f) => ({ ...f, proveedorId: null, cuit: "" }));
                    }}
                  >
                    Cambiar
                  </Button>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Punto de Venta *</Label>
                <Input
                  type="number"
                  value={form.puntoVenta}
                  onChange={(e) => setForm((f) => ({ ...f, puntoVenta: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>N° de Factura *</Label>
                <Input
                  type="number"
                  value={form.nroFactura}
                  onChange={(e) => setForm((f) => ({ ...f, nroFactura: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>CUIT *</Label>
                <Input value={form.cuit} readOnly />
              </div>
              <div className="space-y-2">
                <Label>Fecha *</Label>
                <InputFecha
                  value={form.fecha}
                  onChange={(v) => setForm((f) => ({ ...f, fecha: v }))}
                  className="h-9 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
                  placeholder="DD/MM/YYYY"
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Descripción</Label>
                <textarea
                  value={form.descripcion}
                  onChange={(e) => setForm((f) => ({ ...f, descripcion: e.target.value }))}
                  className="min-h-[90px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
                />
              </div>
              <div className="space-y-2">
                <Label>Tipo de Comprobante</Label>
                <Input
                  value={form.tipoComprobante}
                  onChange={(e) => setForm((f) => ({ ...f, tipoComprobante: e.target.value.toUpperCase() }))}
                  placeholder="A, B o C"
                />
              </div>
              <div className="space-y-2">
                <Label>Importe *</Label>
                <div className="flex items-center rounded-md border border-input overflow-hidden">
                  <span className="px-3 bg-gray-50 text-gray-600 text-sm">$</span>
                  <input
                    type="text"
                    value={form.importeStr}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, importeStr: formatCurrencyInput(e.target.value) }))
                    }
                    className="h-9 w-full px-3 text-sm outline-none"
                    placeholder="0,00"
                  />
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenModal(false)}>
              Cancelar
            </Button>
            <Button onClick={() => void guardarFactura()} disabled={saving}>
              {saving ? "Guardando..." : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
