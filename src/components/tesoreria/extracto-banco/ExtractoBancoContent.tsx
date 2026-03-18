"use client";

import { useState, useEffect, useCallback } from "react";
import { formatearImporteAR } from "@/lib/parsearExtracto";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InputFecha } from "@/components/ui/InputFecha";
import { Search, FolderUp, Trash2, Pencil } from "lucide-react";
import { TablaMovimientos, type MovimientoExtracto } from "./TablaMovimientos";
import { ModalImportarExtracto } from "./ModalImportarExtracto";
import { ModalEditarCuentaMovimiento } from "./ModalEditarCuentaMovimiento";
import { ModalEditarCodOperativo } from "./ModalEditarCodOperativo";

const PER_PAGE = 20;
const API_BASE = "/api/tesoreria/extracto-banco";

export function ExtractoBancoContent() {
  const [data, setData] = useState<MovimientoExtracto[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [cuentaId, setCuentaId] = useState<string>("");
  const [cuentas, setCuentas] = useState<{ id: number; codigo: string; nombre: string }[]>([]);
  const [mensaje, setMensaje] = useState<{ tipo: "ok" | "error"; text: string } | null>(null);
  const [modalImportarOpen, setModalImportarOpen] = useState(false);
  const [modalEditarCuentaOpen, setModalEditarCuentaOpen] = useState(false);
  const [movimientoEditar, setMovimientoEditar] = useState<MovimientoExtracto | null>(null);
  const [modalEditarCodOpOpen, setModalEditarCodOpOpen] = useState(false);
  const [movimientoEditarCodOp, setMovimientoEditarCodOp] = useState<MovimientoExtracto | null>(null);
  const [seleccionados, setSeleccionados] = useState<Set<number>>(new Set());
  const [confirmEliminar, setConfirmEliminar] = useState(false);
  const [saldoInicial, setSaldoInicial] = useState(0);
  const [fechaSaldoInicial, setFechaSaldoInicial] = useState<string>("");
  const [sumaMovimientosTotal, setSumaMovimientosTotal] = useState(0);
  const [editandoSaldo, setEditandoSaldo] = useState(false);
  const [saldoInicialInput, setSaldoInicialInput] = useState("");
  const [fechaSaldoInicialInput, setFechaSaldoInicialInput] = useState("");
  const [guardandoSaldo, setGuardandoSaldo] = useState(false);

  const fetchMovimientos = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("perPage", String(PER_PAGE));
      if (search) params.set("q", search);
      if (desde) params.set("desde", desde);
      if (hasta) params.set("hasta", hasta);
      if (cuentaId) params.set("cuentaId", cuentaId);
      const res = await fetch(`${API_BASE}?${params}`);
      const json = await res.json();
      if (res.ok) {
        setData(json.data ?? []);
        setTotal(json.total ?? 0);
        const sum = Number(json.sumaTotal);
        setSumaMovimientosTotal(Number.isNaN(sum) ? 0 : sum);
        setSeleccionados(new Set());
      }
    } finally {
      setLoading(false);
    }
  }, [page, search, desde, hasta, cuentaId]);

  useEffect(() => {
    fetchMovimientos();
  }, [fetchMovimientos]);

  useEffect(() => {
    setSeleccionados(new Set());
  }, [search, desde, hasta, cuentaId, page]);

  useEffect(() => {
    if (seleccionados.size === 0) setConfirmEliminar(false);
  }, [seleccionados.size]);

  useEffect(() => {
    fetch("/api/tesoreria/cuentas-bancarias/todas")
      .then((r) => r.json())
      .then((d) => (Array.isArray(d) ? setCuentas(d) : []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch("/api/tesoreria/extracto-banco/config")
      .then((r) => r.json())
      .then((d) => {
        const valor = Number(d?.saldoInicial ?? 0);
        if (!Number.isNaN(valor) && valor >= 0) {
          setSaldoInicial(valor);
        }
        const fecha = d?.fechaSaldoInicial;
        setFechaSaldoInicial(typeof fecha === "string" ? fecha : "");
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!mensaje) return;
    const t = setTimeout(() => setMensaje(null), 4000);
    return () => clearTimeout(t);
  }, [mensaje]);

  const showMessage = useCallback((tipo: "ok" | "error", text: string) => {
    setMensaje({ tipo, text });
  }, []);

  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));

  const handleEditarCuenta = (m: MovimientoExtracto) => {
    setMovimientoEditar(m);
    setModalEditarCuentaOpen(true);
  };

  const handleEditarCodOp = (m: MovimientoExtracto) => {
    setMovimientoEditarCodOp(m);
    setModalEditarCodOpOpen(true);
  };

  const handleEliminar = (m: MovimientoExtracto) => {
    if (!confirm("¿Eliminar este movimiento del extracto?")) return;
    fetch(`${API_BASE}/${m.id}`, { method: "DELETE" })
      .then(async (res) => {
        if (res.ok) {
          showMessage("ok", "Movimiento eliminado.");
          fetchMovimientos();
        } else {
          const data = await res.json();
          showMessage("error", data.error || "Error al eliminar");
        }
      })
      .catch(() => showMessage("error", "Error de conexión"));
  };

  const toggleSeleccion = useCallback((id: number) => {
    setSeleccionados((prev) => {
      const nuevo = new Set(prev);
      if (nuevo.has(id)) nuevo.delete(id);
      else nuevo.add(id);
      return nuevo;
    });
  }, []);

  const toggleTodos = useCallback(() => {
    if (data.length === 0) return;
    const todosLosIds = data.map((m) => m.id);
    const todosSeleccionados = todosLosIds.every((id) => seleccionados.has(id));
    if (todosSeleccionados) {
      setSeleccionados(new Set());
    } else {
      setSeleccionados(new Set(todosLosIds));
    }
  }, [data, seleccionados]);

  const eliminarSeleccionados = useCallback(() => {
    if (seleccionados.size === 0) return;
    setConfirmEliminar(true);
  }, [seleccionados.size]);

  const confirmarEliminarSeleccionados = useCallback(async () => {
    if (seleccionados.size === 0) return;
    try {
      const ids = Array.from(seleccionados);
      const res = await fetch(API_BASE, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      const json = await res.json().catch(() => ({}));

      setSeleccionados(new Set());
      setConfirmEliminar(false);
      await fetchMovimientos();

      if (res.ok && json.deleted != null) {
        showMessage("ok", `${json.deleted} movimiento(s) eliminado(s) de la base de datos.`);
      } else {
        showMessage("error", json.error || "No se pudieron eliminar los movimientos en la base de datos.");
      }
    } catch {
      showMessage("error", "Error al eliminar los movimientos seleccionados.");
    }
  }, [seleccionados, fetchMovimientos, showMessage]);

  const comenzarEditarSaldo = () => {
    setSaldoInicialInput(
      saldoInicial.toLocaleString("es-AR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    );
    setFechaSaldoInicialInput(fechaSaldoInicial);
    setEditandoSaldo(true);
  };

  /** Parsea DD/MM/YY o DD/MM/YYYY a Date (inicio del día en AR) para comparar */
  const parseFechaFiltro = (str: string): Date | null => {
    const t = (str ?? "").trim();
    const parts = t.split("/").map((p) => parseInt(p, 10));
    if (parts.length < 3) return null;
    let [d, m, y] = parts;
    if (!d || !m || !y) return null;
    if (y < 100) y += 2000;
    const monthIndex = m - 1;
    if (monthIndex < 0 || monthIndex > 11 || d < 1 || d > 31) return null;
    const iso = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}T00:00:00.000-03:00`;
    return new Date(iso);
  };

  const guardarSaldoInicial = async () => {
    const normalizado = saldoInicialInput.replace(/\./g, "").replace(",", ".");
    const valor = Number.parseFloat(normalizado);
    if (Number.isNaN(valor) || valor < 0) {
      showMessage("error", "Ingresá un saldo inicial válido (número mayor o igual a 0).");
      return;
    }
    const fechaVal = (fechaSaldoInicialInput ?? "").trim();
    const payload: { saldoInicial: number; fechaSaldoInicial: string | null } = {
      saldoInicial: valor,
      fechaSaldoInicial: fechaVal === "" ? null : fechaVal,
    };
    setGuardandoSaldo(true);
    try {
      const res = await fetch("/api/tesoreria/extracto-banco/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const dataRes = await res.json().catch(() => ({}));
      if (!res.ok) {
        showMessage("error", dataRes.error || "Error al guardar saldo inicial.");
        return;
      }
      const nuevo = Number(dataRes?.saldoInicial ?? valor);
      setSaldoInicial(Number.isNaN(nuevo) ? valor : nuevo);
      setFechaSaldoInicial(typeof dataRes?.fechaSaldoInicial === "string" ? dataRes.fechaSaldoInicial : "");
      setEditandoSaldo(false);
      showMessage("ok", "Saldo inicial actualizado.");
    } catch {
      showMessage("error", "Error de conexión al guardar el saldo inicial.");
    } finally {
      setGuardandoSaldo(false);
    }
  };

  const saldoTotal = saldoInicial + sumaMovimientosTotal;

  const mostrarFilaSaldoInicial =
    saldoInicial > 0 &&
    fechaSaldoInicial !== "" &&
    page === 1 &&
    (() => {
      if (!desde.trim()) return true;
      const dDesde = parseFechaFiltro(desde);
      const dFechaSaldo = parseFechaFiltro(fechaSaldoInicial);
      if (!dDesde || !dFechaSaldo) return true;
      return dFechaSaldo.getTime() >= dDesde.getTime();
    })();
  const saldoInicialRow = mostrarFilaSaldoInicial
    ? { fechaDisplay: fechaSaldoInicial, concepto: "Saldo Inicial", saldo: saldoInicial }
    : null;

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

      <Card>
        <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-4">
          <div className="space-y-1">
            <CardTitle>Movimientos</CardTitle>
            <div className="text-sm text-gray-700 flex flex-wrap items-center gap-2">
              <span>Saldo Inicial:</span>
              {!editandoSaldo ? (
                <>
                  <span className="font-semibold text-green-700">
                    $ {formatearImporteAR(saldoInicial)}
                  </span>
                  {fechaSaldoInicial && (
                    <>
                      <span className="text-gray-500">al</span>
                      <span className="text-gray-800">{fechaSaldoInicial}</span>
                    </>
                  )}
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-gray-600 hover:text-blue-700"
                    onClick={comenzarEditarSaldo}
                    title="Editar saldo inicial"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                </>
              ) : (
                <>
                  <Input
                    value={saldoInicialInput}
                    onChange={(e) => setSaldoInicialInput(e.target.value)}
                    className="w-36 h-8 text-sm"
                    placeholder="Ej: 12.345,67"
                  />
                  <span className="text-gray-500">al</span>
                  <InputFecha
                    value={fechaSaldoInicialInput}
                    onChange={setFechaSaldoInicialInput}
                    className="w-28 h-8 text-sm flex rounded-md border border-input bg-transparent px-2 py-1 shadow-sm"
                    placeholder="DD/MM/YYYY"
                  />
                  <Button
                    type="button"
                    size="sm"
                    className="h-8"
                    onClick={guardarSaldoInicial}
                    disabled={guardandoSaldo}
                  >
                    {guardandoSaldo ? "Guardando…" : "Guardar"}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-8"
                    onClick={() => setEditandoSaldo(false)}
                    disabled={guardandoSaldo}
                  >
                    Cancelar
                  </Button>
                </>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            <div className="relative min-w-[180px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Buscar..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <InputFecha
              placeholder="Desde (DD/MM/YY)"
              value={desde}
              onChange={setDesde}
              className="w-32 h-9 rounded-md border border-gray-300 px-3 text-sm"
            />
            <InputFecha
              placeholder="Hasta (DD/MM/YY)"
              value={hasta}
              onChange={setHasta}
              className="w-32 h-9 rounded-md border border-gray-300 px-3 text-sm"
            />
            <select
              value={cuentaId}
              onChange={(e) => setCuentaId(e.target.value)}
              className="h-9 rounded-md border border-gray-300 px-3 text-sm min-w-[180px]"
            >
              <option value="">Todas las cuentas</option>
              {cuentas.map((c) => (
                <option key={c.id} value={String(c.id)}>
                  {c.codigo} – {c.nombre}
                </option>
              ))}
            </select>
            <Button size="sm" className="bg-[#4CAF50] hover:bg-[#388E3C]" onClick={() => setModalImportarOpen(true)}>
              <FolderUp className="h-4 w-4 mr-1" />
              Importar
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-700">
              Saldo Inicial:{" "}
              <span className="font-semibold text-green-700">
                $ {formatearImporteAR(saldoInicial)}
              </span>
              {fechaSaldoInicial && (
                <span className="text-gray-600 ml-1">al {fechaSaldoInicial}</span>
              )}
            </p>
            <p className="text-base font-semibold text-green-800">
              Saldo Total: $ {formatearImporteAR(saldoTotal)}
            </p>
          </div>
          {seleccionados.size > 0 && (
            <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded px-4 py-2 mb-2">
              <span className="text-sm text-red-700 font-medium">
                {seleccionados.size} movimiento(s) seleccionado(s)
              </span>
              <button
                onClick={eliminarSeleccionados}
                className="flex items-center gap-1 bg-red-600 text-white text-sm px-3 py-1.5 rounded hover:bg-red-700"
              >
                <Trash2 className="w-3 h-3" />
                Eliminar seleccionados
              </button>
              <button
                onClick={() => setSeleccionados(new Set())}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                Cancelar
              </button>
            </div>
          )}

          <TablaMovimientos
            data={data}
            loading={loading}
            saldoInicialRow={saldoInicialRow}
            onEditarCuenta={handleEditarCuenta}
            onEditarCodOp={handleEditarCodOp}
            onEliminar={handleEliminar}
            seleccionados={seleccionados}
            onToggleSeleccion={toggleSeleccion}
            onToggleTodos={toggleTodos}
          />

          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-600">
                Página {page} de {totalPages} ({total} movimientos)
              </p>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                  Anterior
                </Button>
                <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                  Siguiente
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <ModalImportarExtracto
        open={modalImportarOpen}
        onOpenChange={setModalImportarOpen}
        onSuccess={fetchMovimientos}
        showMessage={showMessage}
      />
      <ModalEditarCuentaMovimiento
        open={modalEditarCuentaOpen}
        onOpenChange={setModalEditarCuentaOpen}
        movimiento={movimientoEditar}
        onSuccess={fetchMovimientos}
        showMessage={showMessage}
      />
      <ModalEditarCodOperativo
        open={modalEditarCodOpOpen}
        onOpenChange={setModalEditarCodOpOpen}
        movimiento={movimientoEditarCodOp}
        onSuccess={fetchMovimientos}
        showMessage={showMessage}
      />

      {confirmEliminar && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-sm w-full mx-4 shadow-xl">
            <h3 className="font-semibold text-gray-900 mb-2">⚠️ Eliminar movimientos</h3>
            <p className="text-sm text-gray-600 mb-4">
              ¿Estás seguro de que querés eliminar{" "}
              <strong>{seleccionados.size} movimiento(s)</strong>? Esta acción es irreversible.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setConfirmEliminar(false)}
                className="px-3 py-2 text-sm border rounded hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={confirmarEliminarSeleccionados}
                className="px-3 py-2 text-sm bg-red-600 text-white rounded hover:bg-red-700"
              >
                Sí, eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
