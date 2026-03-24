"use client";

import { useCallback, useEffect, useState, useRef, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { InputFecha } from "@/components/ui/InputFecha";
import { Label } from "@/components/ui/label";
import {
  Calendar,
  Pencil,
  Check,
  Trash2,
  Download,
  Plus,
  Zap,
  Search,
  FileSpreadsheet,
  ListOrdered,
} from "lucide-react";
import type { MayorCuenta, MayorMovimiento } from "@/types/tesoreria";
import { formatearFechaUTC, parsearFechaSegura } from "@/lib/utils/fecha";
import { exportarMayoresExcel } from "@/lib/tesoreria/exportMayoresExcel";
import {
  ddmmyyyyToIsoYmd,
  primerUltimoDiaMesActualDdmm,
} from "@/lib/tesoreria/periodoMayor";
import { ModalMayorGastosExtracto } from "./ModalMayorGastosExtracto";
import { ModalMayorGastosFondoFijo } from "./ModalMayorGastosFondoFijo";
import { ModalMayorReglas } from "./ModalMayorReglas";
import { ModalEditarMayorMovimiento } from "./ModalEditarMayorMovimiento";
import { ModalExportarMinutaMayor } from "./ModalExportarMinutaMayor";
import {
  exportarMovimientosPeriodoExcel,
  exportarMinutaMayorMovimientos,
} from "@/lib/tesoreria/exportMayorMovimientosPeriodo";

function etiquetaOrigen(o: string): string {
  if (o === "EXTRACTO") return "Extracto Banco";
  if (o === "FONDO_FIJO") return "Fondo Fijo";
  if (o === "MANUAL") return "Manual";
  return o;
}

function normalizarTextoBusqueda(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .trim();
}

type BorradorCuenta = { key: string; nombre: string };

export function MayoresCuentasContent() {
  const inicial = useMemo(() => primerUltimoDiaMesActualDdmm(), []);
  const [periodoDesde, setPeriodoDesde] = useState(inicial.desde);
  const [periodoHasta, setPeriodoHasta] = useState(inicial.hasta);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [draftDesde, setDraftDesde] = useState(inicial.desde);
  const [draftHasta, setDraftHasta] = useState(inicial.hasta);
  const pickerRef = useRef<HTMLDivElement>(null);

  const [cuentas, setCuentas] = useState<MayorCuenta[]>([]);
  const [borradores, setBorradores] = useState<BorradorCuenta[]>([]);
  const [movimientos, setMovimientos] = useState<MayorMovimiento[]>([]);
  const [loading, setLoading] = useState(true);
  const [mensaje, setMensaje] = useState<{ tipo: "ok" | "error"; text: string } | null>(null);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editNombre, setEditNombre] = useState("");

  const [modalExtracto, setModalExtracto] = useState(false);
  const [modalFondo, setModalFondo] = useState(false);
  const [modalReglas, setModalReglas] = useState(false);
  const [modalEditMov, setModalEditMov] = useState(false);
  const [movEditar, setMovEditar] = useState<MayorMovimiento | null>(null);
  const [modalMinuta, setModalMinuta] = useState(false);
  const [busquedaMovs, setBusquedaMovs] = useState("");

  const periodoYmd = useMemo(() => {
    const desde = ddmmyyyyToIsoYmd(periodoDesde);
    const hasta = ddmmyyyyToIsoYmd(periodoHasta);
    if (!desde || !hasta) return null;
    return { desde, hasta };
  }, [periodoDesde, periodoHasta]);

  const showMessage = useCallback((tipo: "ok" | "error", text: string) => {
    setMensaje({ tipo, text });
  }, []);

  useEffect(() => {
    if (!mensaje) return;
    const t = setTimeout(() => setMensaje(null), 4000);
    return () => clearTimeout(t);
  }, [mensaje]);

  useEffect(() => {
    if (pickerOpen) {
      setDraftDesde(periodoDesde);
      setDraftHasta(periodoHasta);
    }
  }, [pickerOpen, periodoDesde, periodoHasta]);

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

  const fetchCuentas = useCallback(async () => {
    try {
      const res = await fetch("/api/tesoreria/mayor-cuentas");
      const data = await res.json();
      if (res.ok && Array.isArray(data)) setCuentas(data as MayorCuenta[]);
      else setCuentas([]);
    } catch {
      setCuentas([]);
    }
  }, []);

  const fetchMovimientos = useCallback(async () => {
    const desde = ddmmyyyyToIsoYmd(periodoDesde);
    const hasta = ddmmyyyyToIsoYmd(periodoHasta);
    if (!desde || !hasta) {
      setMovimientos([]);
      return;
    }
    try {
      const res = await fetch(
        `/api/tesoreria/mayor-movimientos?desde=${encodeURIComponent(desde)}&hasta=${encodeURIComponent(hasta)}`
      );
      const data = await res.json();
      if (res.ok && Array.isArray(data)) setMovimientos(data as MayorMovimiento[]);
      else setMovimientos([]);
    } catch {
      setMovimientos([]);
    }
  }, [periodoDesde, periodoHasta]);

  const refreshTodo = useCallback(async () => {
    setLoading(true);
    await Promise.all([fetchCuentas(), fetchMovimientos()]);
    setLoading(false);
  }, [fetchCuentas, fetchMovimientos]);

  useEffect(() => {
    void refreshTodo();
  }, [refreshTodo]);

  useEffect(() => {
    setBusquedaMovs("");
  }, [periodoDesde, periodoHasta]);

  const aplicarPeriodo = () => {
    const d0 = parsearFechaSegura(draftDesde.trim());
    const d1 = parsearFechaSegura(draftHasta.trim());
    if (!d0 || !d1) {
      showMessage("error", "Revisá las fechas (DD/MM/YYYY).");
      return;
    }
    if (d0.getTime() > d1.getTime()) {
      showMessage("error", "La fecha Desde no puede ser posterior a Hasta.");
      return;
    }
    setPeriodoDesde(formatearFechaUTC(d0));
    setPeriodoHasta(formatearFechaUTC(d1));
    setPickerOpen(false);
  };

  const aplicarEsteMes = () => {
    const { desde, hasta } = primerUltimoDiaMesActualDdmm();
    setDraftDesde(desde);
    setDraftHasta(hasta);
  };

  const crearFilaBorrador = () => {
    setBorradores((b) => [...b, { key: `n-${Date.now()}`, nombre: "" }]);
  };

  const guardarBorrador = async (br: BorradorCuenta) => {
    const nombre = br.nombre.trim();
    if (!nombre) {
      showMessage("error", "Ingresá un nombre.");
      return;
    }
    try {
      const res = await fetch("/api/tesoreria/mayor-cuentas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showMessage("error", data?.error || "Error al crear.");
        return;
      }
      setBorradores((b) => b.filter((x) => x.key !== br.key));
      await fetchCuentas();
      showMessage("ok", "Cuenta creada.");
    } catch {
      showMessage("error", "Error de conexión.");
    }
  };

  const iniciarEdicion = (c: MayorCuenta) => {
    setEditingId(c.id);
    setEditNombre(c.nombre);
  };

  const guardarEdicion = async (c: MayorCuenta) => {
    const nombre = editNombre.trim();
    if (!nombre) {
      showMessage("error", "El nombre no puede quedar vacío.");
      return;
    }
    try {
      const res = await fetch(`/api/tesoreria/mayor-cuentas/${c.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre, orden: c.orden }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showMessage("error", data?.error || "Error al guardar.");
        return;
      }
      setEditingId(null);
      await fetchCuentas();
      showMessage("ok", "Cuenta actualizada.");
    } catch {
      showMessage("error", "Error de conexión.");
    }
  };

  const eliminarCuenta = async (c: MayorCuenta) => {
    if (!confirm(`¿Eliminar la cuenta "${c.nombre}" y sus movimientos?`)) return;
    try {
      const res = await fetch(`/api/tesoreria/mayor-cuentas/${c.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        showMessage("error", data?.error || "Error al eliminar.");
        return;
      }
      if (editingId === c.id) setEditingId(null);
      await fetchCuentas();
      await fetchMovimientos();
      showMessage("ok", "Cuenta eliminada.");
    } catch {
      showMessage("error", "Error de conexión.");
    }
  };

  const eliminarMovimiento = async (m: MayorMovimiento) => {
    if (!confirm("¿Eliminar este movimiento del mayor?")) return;
    try {
      const res = await fetch(`/api/tesoreria/mayor-movimientos/${m.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        showMessage("error", data?.error || "Error al eliminar.");
        return;
      }
      await fetchMovimientos();
      showMessage("ok", "Movimiento eliminado.");
    } catch {
      showMessage("error", "Error de conexión.");
    }
  };

  const cuentasOrdenadas = [...cuentas].sort(
    (a, b) => a.orden - b.orden || a.id - b.id
  );

  const movimientosFiltrados = useMemo(() => {
    const q = normalizarTextoBusqueda(busquedaMovs);
    if (!q) return movimientos;
    return movimientos.filter((m) => {
      const fechaTxt = m.fecha
        ? formatearFechaUTC(new Date(m.fecha))
        : "";
      const importeFmt = m.importe.toLocaleString("es-AR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
      const campos = [
        m.concepto,
        m.cuentaNombre,
        etiquetaOrigen(m.origen),
        m.origen,
        String(m.id),
        fechaTxt,
        importeFmt,
        String(m.importe),
      ];
      return campos.some((c) =>
        normalizarTextoBusqueda(String(c)).includes(q)
      );
    });
  }, [movimientos, busquedaMovs]);

  const exportExcel = () => {
    if (!periodoYmd) {
      showMessage("error", "Definí un período válido.");
      return;
    }
    try {
      const sufijo = `${periodoDesde.replace(/\//g, "")}_${periodoHasta.replace(/\//g, "")}`;
      exportarMayoresExcel(cuentasOrdenadas, movimientos, sufijo);
      showMessage("ok", "Excel generado.");
    } catch {
      showMessage("error", "Error al generar Excel.");
    }
  };

  const textoBotonPeriodo = `Periodo Desde ${periodoDesde} - Hasta ${periodoHasta}`;

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

      <div className="flex flex-wrap items-center gap-2 mb-4 relative" ref={pickerRef}>
        <button
          type="button"
          onClick={() => setPickerOpen((o) => !o)}
          className="flex items-center gap-2 bg-sky-500 hover:bg-sky-600 text-white text-sm px-4 py-2 rounded-lg max-w-full text-left"
          title={textoBotonPeriodo}
        >
          <Calendar className="w-4 h-4 shrink-0" />
          <span className="leading-snug break-words">{textoBotonPeriodo}</span>
        </button>

        {pickerOpen && (
          <div className="absolute left-0 top-full mt-1 z-50 w-[min(100vw-2rem,380px)] rounded-xl border border-gray-200 bg-white p-4 shadow-lg">
            <p className="text-sm font-medium text-gray-800 mb-3">Período</p>
            <div className="space-y-3">
              <div>
                <Label className="text-xs text-muted-foreground">Desde (DD/MM/YYYY)</Label>
                <InputFecha
                  value={draftDesde}
                  onChange={setDraftDesde}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm mt-1"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Hasta (DD/MM/YYYY)</Label>
                <InputFecha
                  value={draftHasta}
                  onChange={setDraftHasta}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm mt-1"
                />
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2 justify-between border-t border-gray-100 pt-3">
              <button
                type="button"
                onClick={() => setPickerOpen(false)}
                className="text-sm font-medium text-gray-500 hover:text-gray-700"
              >
                Cerrar
              </button>
              <button
                type="button"
                onClick={aplicarEsteMes}
                className="text-sm font-medium text-blue-600 hover:text-blue-800"
              >
                Este mes
              </button>
              <Button type="button" size="sm" onClick={aplicarPeriodo}>
                Aplicar
              </Button>
            </div>
          </div>
        )}

        <Button
          type="button"
          variant="secondary"
          className="border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-900"
          onClick={() => setModalReglas(true)}
          title="Reglas de asignación automática"
        >
          <Zap className="w-4 h-4 mr-2" />
          Reglas
        </Button>
        <Button
          type="button"
          className="bg-green-600 hover:bg-green-700 text-white"
          onClick={crearFilaBorrador}
        >
          <Plus className="w-4 h-4 mr-2" />
          Crear Cuenta
        </Button>
        <Button
          type="button"
          className="bg-blue-600 hover:bg-blue-700 text-white"
          disabled={!periodoYmd}
          onClick={() => setModalExtracto(true)}
        >
          Gastos Extracto Banco
        </Button>
        <Button
          type="button"
          className="bg-blue-600 hover:bg-blue-700 text-white"
          disabled={!periodoYmd}
          onClick={() => setModalFondo(true)}
        >
          Gastos Fondo Fijo
        </Button>
        <Button
          type="button"
          className="bg-orange-500 hover:bg-orange-600 text-white"
          onClick={exportExcel}
          disabled={!periodoYmd}
        >
          <Download className="w-4 h-4 mr-2" />
          Mayores Excel
        </Button>
      </div>

      <Card>
        <CardHeader>
          <span className="font-semibold text-lg">Cuentas</span>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-gray-600">
                  <th className="p-3 pl-4">Nombre</th>
                  <th className="p-3 text-right pr-4 w-40">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {cuentasOrdenadas.map((c) => (
                  <tr key={c.id} className="border-b hover:bg-muted/40">
                    <td className="p-3 pl-4">
                      {editingId === c.id ? (
                        <Input
                          value={editNombre}
                          onChange={(e) => setEditNombre(e.target.value)}
                          className="max-w-md"
                        />
                      ) : (
                        <span>{c.nombre}</span>
                      )}
                    </td>
                    <td className="p-3 text-right pr-4">
                      <div className="flex justify-end gap-1">
                        {editingId === c.id ? (
                          <button
                            type="button"
                            title="Guardar"
                            className="p-2 text-green-600 hover:bg-green-50 rounded-md"
                            onClick={() => void guardarEdicion(c)}
                          >
                            <Check className="w-4 h-4" />
                          </button>
                        ) : (
                          <button
                            type="button"
                            title="Editar"
                            className="p-2 text-gray-500 hover:text-blue-600 rounded-md"
                            onClick={() => iniciarEdicion(c)}
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          type="button"
                          title="Eliminar"
                          className="p-2 text-red-500 hover:bg-red-50 rounded-md"
                          onClick={() => void eliminarCuenta(c)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {borradores.map((br) => (
                  <tr key={br.key} className="border-b bg-green-50/50">
                    <td className="p-3 pl-4">
                      <Input
                        value={br.nombre}
                        onChange={(e) =>
                          setBorradores((rows) =>
                            rows.map((x) =>
                              x.key === br.key ? { ...x, nombre: e.target.value } : x
                            )
                          )
                        }
                        placeholder="Nombre de la cuenta"
                        className="max-w-md"
                      />
                    </td>
                    <td className="p-3 text-right pr-4">
                      <div className="flex justify-end gap-1">
                        <button
                          type="button"
                          title="Guardar"
                          className="p-2 text-green-600 hover:bg-green-100 rounded-md"
                          onClick={() => void guardarBorrador(br)}
                        >
                          <Check className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          title="Quitar"
                          className="p-2 text-gray-500 hover:bg-gray-100 rounded-md"
                          onClick={() =>
                            setBorradores((b) => b.filter((x) => x.key !== br.key))
                          }
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {cuentasOrdenadas.length === 0 && borradores.length === 0 && !loading && (
                  <tr>
                    <td colSpan={2} className="p-8 text-center text-muted-foreground">
                      No hay cuentas. Usá &quot;Crear Cuenta&quot;.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
            <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center sm:flex-wrap sm:gap-2">
              <span className="font-semibold text-lg leading-snug shrink-0">
                Movimientos del período ({periodoDesde} — {periodoHasta})
              </span>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="border-green-600 text-green-700 hover:bg-green-50 hover:text-green-800 disabled:cursor-not-allowed"
                  disabled={loading || movimientos.length === 0}
                  title="Exportar Excel"
                  onClick={() => {
                    exportarMovimientosPeriodoExcel(
                      movimientos,
                      periodoDesde,
                      periodoHasta
                    );
                    showMessage("ok", "Archivo exportado correctamente");
                  }}
                >
                  <FileSpreadsheet className="mr-1.5 h-4 w-4 text-green-600" aria-hidden />
                  Exportar
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="disabled:cursor-not-allowed"
                  disabled={loading || movimientos.length === 0}
                  title="Exportar Minuta"
                  onClick={() => setModalMinuta(true)}
                >
                  <ListOrdered className="mr-1.5 h-4 w-4" aria-hidden />
                  Exportar Minuta
                </Button>
              </div>
            </div>
            <div className="relative w-full sm:max-w-xs shrink-0">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              <Input
                type="search"
                value={busquedaMovs}
                onChange={(e) => setBusquedaMovs(e.target.value)}
                placeholder="Buscar en tiempo real…"
                className="pl-9 h-9"
                aria-label="Buscar movimientos"
                autoComplete="off"
              />
            </div>
          </div>
          {!loading && movimientos.length > 0 && (
            <p className="text-xs text-muted-foreground">
              {busquedaMovs.trim()
                ? `Mostrando ${movimientosFiltrados.length} de ${movimientos.length} movimiento(s).`
                : `${movimientos.length} movimiento(s) en el período.`}
            </p>
          )}
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground py-8 text-center">Cargando…</p>
          ) : (
            <div className="border rounded-lg overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-gray-600">
                    <th className="p-2 pl-3">Fecha</th>
                    <th className="p-2">Concepto</th>
                    <th className="p-2 text-right">Importe</th>
                    <th className="p-2">Cuenta</th>
                    <th className="p-2">Origen</th>
                    <th className="p-2 text-right pr-3">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {movimientos.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-muted-foreground">
                        No hay movimientos en este período.
                      </td>
                    </tr>
                  ) : movimientosFiltrados.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-muted-foreground">
                        Ningún movimiento coincide con &quot;{busquedaMovs.trim()}&quot;. Probá con
                        otras palabras o limpiá el buscador.
                      </td>
                    </tr>
                  ) : (
                    movimientosFiltrados.map((m) => (
                      <tr key={m.id} className="border-b hover:bg-muted/40">
                        <td className="p-2 pl-3 whitespace-nowrap">
                          {m.fecha
                            ? formatearFechaUTC(new Date(m.fecha))
                            : "—"}
                        </td>
                        <td className="p-2 max-w-[240px] truncate" title={m.concepto}>
                          {m.concepto}
                        </td>
                        <td className="p-2 text-right whitespace-nowrap">
                          {m.importe.toLocaleString("es-AR", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </td>
                        <td className="p-2">{m.cuentaNombre}</td>
                        <td className="p-2">{etiquetaOrigen(m.origen)}</td>
                        <td className="p-2 text-right pr-3">
                          <div className="flex justify-end gap-1">
                            <button
                              type="button"
                              className="p-1.5 text-gray-500 hover:text-blue-600"
                              title="Editar"
                              onClick={() => {
                                setMovEditar(m);
                                setModalEditMov(true);
                              }}
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              className="p-1.5 text-red-500 hover:bg-red-50 rounded"
                              title="Eliminar"
                              onClick={() => void eliminarMovimiento(m)}
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
          )}
        </CardContent>
      </Card>

      {periodoYmd && (
        <>
          <ModalMayorGastosExtracto
            open={modalExtracto}
            onOpenChange={setModalExtracto}
            fechaDesdeYmd={periodoYmd.desde}
            fechaHastaYmd={periodoYmd.hasta}
            cuentas={cuentasOrdenadas}
            showMessage={showMessage}
            onAsignado={fetchMovimientos}
          />
          <ModalMayorGastosFondoFijo
            open={modalFondo}
            onOpenChange={setModalFondo}
            fechaDesdeYmd={periodoYmd.desde}
            fechaHastaYmd={periodoYmd.hasta}
            cuentas={cuentasOrdenadas}
            showMessage={showMessage}
            onAsignado={fetchMovimientos}
          />
        </>
      )}
      <ModalEditarMayorMovimiento
        open={modalEditMov}
        onOpenChange={setModalEditMov}
        movimiento={movEditar}
        cuentas={cuentasOrdenadas}
        showMessage={showMessage}
        onGuardado={fetchMovimientos}
      />
      <ModalMayorReglas
        open={modalReglas}
        onOpenChange={setModalReglas}
        cuentas={cuentasOrdenadas}
        showMessage={showMessage}
      />
      <ModalExportarMinutaMayor
        open={modalMinuta}
        onOpenChange={setModalMinuta}
        onExportar={(agrupacion) => {
          exportarMinutaMayorMovimientos(
            movimientos,
            periodoDesde,
            periodoHasta,
            agrupacion
          );
          showMessage("ok", "Archivo exportado correctamente");
        }}
      />
    </div>
  );
}
