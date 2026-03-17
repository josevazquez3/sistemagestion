"use client";

import { useState, useEffect } from "react";
import { Trash2 } from "lucide-react";
import type { FilaConciliacion, ResumenConciliacion } from "@/types/conciliacion";

interface Props {
  filas: FilaConciliacion[];
  resumen: ResumenConciliacion;
  loading?: boolean;
  mes: number;
  anio: number;
  onEliminados: () => void;
  showMessage: (tipo: "ok" | "error", text: string) => void;
}

const fmt = (n: number) =>
  new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 2,
  }).format(n);

export function VistaPreviaConciliacion({
  filas,
  resumen,
  loading,
  mes,
  anio,
  onEliminados,
  showMessage,
}: Props) {
  const [seleccionados, setSeleccionados] = useState<Set<number>>(new Set());
  const [eliminando, setEliminando] = useState(false);

  useEffect(() => {
    setSeleccionados(new Set());
  }, [mes, anio]);

  const todosSeleccionados = filas.length > 0 && seleccionados.size === filas.length;

  const toggleTodos = () => {
    if (todosSeleccionados) {
      setSeleccionados(new Set());
    } else {
      setSeleccionados(new Set(filas.map((f) => f.id)));
    }
  };

  const toggleUno = (id: number) => {
    setSeleccionados((prev) => {
      const nuevo = new Set(prev);
      if (nuevo.has(id)) nuevo.delete(id);
      else nuevo.add(id);
      return nuevo;
    });
  };

  const eliminarPorIds = async (ids: number[]) => {
    if (ids.length === 0) return;
    const msg =
      ids.length === 1
        ? "¿Excluir esta fila de la conciliación? Podés volver a incluirla quitando la exclusión (API) o reasignando cuentas."
        : `¿Excluir ${ids.length} fila${ids.length !== 1 ? "s" : ""} de la vista de conciliación? Los movimientos siguen en el extracto banco.`;
    if (!confirm(msg)) return;

    setEliminando(true);
    try {
      const res = await fetch("/api/tesoreria/conciliacion-banco/exclusiones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mes, anio, movimientoIds: ids }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as { error?: string })?.error || "Error al eliminar");

      showMessage(
        "ok",
        `${ids.length} fila${ids.length !== 1 ? "s" : ""} excluida${ids.length !== 1 ? "s" : ""} de la conciliación.`
      );
      setSeleccionados(new Set());
      onEliminados();
    } catch (err: unknown) {
      showMessage("error", err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setEliminando(false);
    }
  };

  const handleEliminar = () => void eliminarPorIds(Array.from(seleccionados));

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <span className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-200 border-t-emerald-600" />
      </div>
    );
  }

  if (filas.length === 0) {
    return (
      <div className="py-16 text-center text-gray-400">
        <p className="text-sm">
          No hay movimientos para el período seleccionado.
          <br />
          Usá el botón <strong>Conciliar</strong> para asignar cuentas.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {seleccionados.size > 0 && (
        <div className="flex items-center justify-between rounded-xl border border-red-200 bg-red-50 px-4 py-3">
          <span className="text-sm font-medium text-red-700">
            {seleccionados.size} fila{seleccionados.size !== 1 ? "s" : ""} seleccionada
            {seleccionados.size !== 1 ? "s" : ""}
          </span>
          <button
            type="button"
            onClick={handleEliminar}
            disabled={eliminando}
            className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm text-white transition-colors hover:bg-red-700 disabled:opacity-50"
          >
            {eliminando ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
            Eliminar seleccionados ({seleccionados.size})
          </button>
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-gray-200 shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="w-10 px-4 py-3">
                <input
                  type="checkbox"
                  checked={todosSeleccionados}
                  onChange={toggleTodos}
                  className="h-4 w-4 cursor-pointer accent-red-600"
                />
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                Fecha
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                Concepto
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                Cuenta
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-emerald-600">
                Ingreso
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-red-600">
                Salida / Gasto
              </th>
              <th className="w-12 px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            <tr className="bg-blue-50">
              <td />
              <td colSpan={3} className="px-4 py-2.5 text-sm font-semibold text-blue-700">
                Saldo Anterior
              </td>
              <td className="px-4 py-2.5 text-right font-semibold text-blue-700">
                {fmt(resumen.saldoAnterior)}
              </td>
              <td />
              <td />
            </tr>

            {filas.map((fila) => {
              const checked = seleccionados.has(fila.id);
              const colorBadge =
                fila.tipo === "INGRESO" ? "emerald" : fila.tipo === "SALIDA" ? "red" : "amber";

              return (
                <tr
                  key={fila.id}
                  className={`transition-colors ${checked ? "bg-red-50" : "hover:bg-gray-50"}`}
                >
                  <td className="px-4 py-2.5">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleUno(fila.id)}
                      className="h-4 w-4 cursor-pointer accent-red-600"
                    />
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-xs text-gray-500">
                    {new Date(fila.fecha).toLocaleDateString("es-AR")}
                  </td>
                  <td className="max-w-xs truncate px-4 py-2.5 text-gray-700">{fila.concepto}</td>
                  <td className="px-4 py-2.5">
                    <span
                      className={`rounded-full border px-2 py-0.5 text-xs ${
                        colorBadge === "emerald"
                          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                          : colorBadge === "red"
                            ? "border-red-200 bg-red-50 text-red-700"
                            : "border-amber-200 bg-amber-50 text-amber-700"
                      }`}
                    >
                      {fila.cuentaCodigo} – {fila.cuentaNombre}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right font-medium text-emerald-600">
                    {fila.tipo === "INGRESO" ? fmt(Math.abs(fila.monto)) : ""}
                  </td>
                  <td className="px-4 py-2.5 text-right font-medium text-red-600">
                    {fila.tipo !== "INGRESO" ? fmt(Math.abs(fila.monto)) : ""}
                  </td>
                  <td className="px-3 py-2.5">
                    <button
                      type="button"
                      onClick={() => void eliminarPorIds([fila.id])}
                      disabled={eliminando}
                      title="Excluir esta fila de la conciliación"
                      className="rounded-lg p-1.5 text-gray-300 transition-colors hover:bg-red-50 hover:text-red-500 disabled:opacity-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 bg-gray-50 px-5 py-3">
          <h3 className="text-sm font-semibold text-gray-700">Resumen de Conciliación</h3>
        </div>
        <div className="divide-y divide-gray-100">
          <div className="flex items-center justify-between px-5 py-3">
            <span className="text-sm text-gray-600">Saldo Anterior</span>
            <span className="text-sm font-medium text-blue-600">{fmt(resumen.saldoAnterior)}</span>
          </div>
          <div className="flex items-center justify-between px-5 py-3">
            <span className="text-sm font-medium text-emerald-600">Total Ingresos</span>
            <span className="text-sm font-semibold text-emerald-600">
              {fmt(resumen.totalIngresos)}
            </span>
          </div>
          <div className="flex items-center justify-between bg-blue-50 px-5 py-3">
            <span className="text-sm font-semibold text-blue-700">
              Subtotal (Ingresos + Saldo Anterior)
            </span>
            <span className="text-sm font-bold text-blue-700">{fmt(resumen.subtotal)}</span>
          </div>
          <div className="flex items-center justify-between px-5 py-3">
            <span className="text-sm font-medium text-red-600">Total Salidas</span>
            <span className="text-sm font-semibold text-red-600">− {fmt(resumen.totalSalidas)}</span>
          </div>
          <div className="flex items-center justify-between px-5 py-3">
            <span className="text-sm font-medium text-amber-600">Total Gastos</span>
            <span className="text-sm font-semibold text-amber-600">
              − {fmt(resumen.totalGastos)}
            </span>
          </div>
          <div className="flex items-center justify-between bg-emerald-50 px-5 py-4">
            <span className="text-base font-bold text-emerald-700">✓ Total Conciliado</span>
            <span className="text-lg font-bold text-emerald-700">
              {fmt(resumen.totalConciliado)}
            </span>
          </div>
          <div className="bg-gray-50 px-5 py-2">
            <p className="text-xs text-gray-400">
              El Total Conciliado se trasladará como Saldo Anterior del próximo mes.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
