"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { formatearFechaUTC } from "@/lib/utils/fecha";
import { parsearImporteAR } from "@/lib/parsearExtracto";

export function ConciliacionSaldoInicialConfig() {
  const [montoStr, setMontoStr] = useState("");
  const [cargado, setCargado] = useState(false);
  const [actualizadoEn, setActualizadoEn] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [toast, setToast] = useState<{ tipo: "ok" | "error"; text: string } | null>(null);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/tesoreria/conciliacion-banco/saldo-inicial");
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error);
      setMontoStr(
        new Intl.NumberFormat("es-AR", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }).format(Number(data.monto))
      );
      setCargado(!!data.cargado);
      setActualizadoEn(data.actualizadoEn ? new Date(data.actualizadoEn) : null);
    } catch {
      setToast({ tipo: "error", text: "No se pudo cargar el saldo inicial." });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  const handleActualizar = async () => {
    const monto = parsearImporteAR(montoStr.replace(/\$/g, "").trim() || "0");
    if (Number.isNaN(monto) || monto < 0) {
      setToast({ tipo: "error", text: "Monto inválido." });
      return;
    }
    setGuardando(true);
    try {
      const res = await fetch("/api/tesoreria/conciliacion-banco/saldo-inicial", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ monto }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as { error?: string })?.error || "Error");
      setToast({ tipo: "ok", text: "Saldo inicial actualizado correctamente." });
      if (data.actualizadoEn) setActualizadoEn(new Date(data.actualizadoEn));
      setCargado(true);
    } catch {
      setToast({ tipo: "error", text: "No se pudo actualizar el saldo inicial." });
    } finally {
      setGuardando(false);
    }
  };

  const horaModificacion =
    actualizadoEn != null
      ? `${formatearFechaUTC(actualizadoEn)} — ${actualizadoEn.toLocaleTimeString("es-AR", {
          hour: "2-digit",
          minute: "2-digit",
        })} hs`
      : null;

  if (loading) {
    return (
      <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <p className="text-sm text-gray-500">Cargando…</p>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-amber-200 bg-amber-50/30 p-6 shadow-sm">
      {toast && (
        <div
          className={`mb-4 rounded-lg px-3 py-2 text-sm font-medium ${
            toast.tipo === "ok" ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"
          }`}
        >
          {toast.text}
        </div>
      )}
      <h2 className="text-lg font-semibold text-gray-800">Conciliación Bancaria</h2>
      <p className="mt-3 text-sm font-medium text-gray-700">Saldo inicial de arranque</p>
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <div>
          <label className="sr-only" htmlFor="saldo-inicial-super">
            Monto
          </label>
          <input
            id="saldo-inicial-super"
            type="text"
            inputMode="decimal"
            value={montoStr}
            onChange={(e) => setMontoStr(e.target.value)}
            className="w-48 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium tabular-nums shadow-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
            placeholder="0,00"
          />
        </div>
        <Button
          type="button"
          onClick={() => void handleActualizar()}
          disabled={guardando}
          className="bg-amber-600 hover:bg-amber-700 text-white"
        >
          {guardando ? "Guardando…" : "Actualizar"}
        </Button>
      </div>
      <p className="mt-3 text-xs text-amber-900/80">
        Este valor solo debería modificarse si fue ingresado incorrectamente la primera vez.
      </p>
      {cargado && horaModificacion && (
        <p className="mt-2 text-xs text-gray-600">
          Última modificación: <span className="font-medium">{horaModificacion}</span>
        </p>
      )}
    </section>
  );
}
