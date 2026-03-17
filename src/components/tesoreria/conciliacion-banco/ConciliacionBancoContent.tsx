"use client";

import { useState, useEffect, useCallback } from "react";
import { SlidersHorizontal } from "lucide-react";
import { CalendarioConciliacion } from "./CalendarioConciliacion";
import { ModalConciliar } from "./ModalConciliar";
import { VistaPreviaConciliacion } from "./VistaPreviaConciliacion";
import { BotonesExportar } from "./BotonesExportar";
import type {
  CuentaOperativa,
  AsignacionCuenta,
  FilaConciliacion,
  ResumenConciliacion,
  TipoCuenta,
} from "@/types/conciliacion";

const MESES_LABEL = [
  "",
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

export function ConciliacionBancoContent() {
  const hoy = new Date();
  const [mes, setMes] = useState(hoy.getMonth() + 1);
  const [anio, setAnio] = useState(hoy.getFullYear());

  const [cuentasDisponibles, setCuentasDisponibles] = useState<CuentaOperativa[]>([]);
  const [asignacionesActuales, setAsignacionesActuales] = useState<AsignacionCuenta[]>([]);
  const [filas, setFilas] = useState<FilaConciliacion[]>([]);
  const [resumen, setResumen] = useState<ResumenConciliacion>({
    saldoAnterior: 0,
    totalIngresos: 0,
    totalSalidas: 0,
    totalGastos: 0,
    subtotal: 0,
    totalConciliado: 0,
  });

  const [loading, setLoading] = useState(false);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [mensaje, setMensaje] = useState<{ tipo: "ok" | "error"; text: string } | null>(null);

  const showMessage = useCallback((tipo: "ok" | "error", text: string) => {
    setMensaje({ tipo, text });
    setTimeout(() => setMensaje(null), 4000);
  }, []);

  useEffect(() => {
    fetch("/api/tesoreria/conciliacion-banco/cuentas")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setCuentasDisponibles(data);
      })
      .catch(() => {});
  }, []);

  const cargarDatos = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/tesoreria/conciliacion-banco?mes=${mes}&anio=${anio}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error);

      const { conciliacion, movimientos } = data as {
        conciliacion: {
          saldoAnterior: number;
          totalIngresos: number;
          totalSalidas: number;
          totalGastos: number;
          subtotal: number;
          totalConciliado: number;
          asignaciones: AsignacionCuenta[];
        };
        movimientos: Array<{
          id: number;
          fecha: string;
          concepto: string;
          cuentaCodigo: string;
          cuentaNombre: string;
          tipo: string;
          monto: number;
        }>;
      };

      const rawAsig = conciliacion.asignaciones ?? [];
      setAsignacionesActuales(
        rawAsig.map((a) => ({
          id: a.id,
          cuentaCodigo: a.cuentaCodigo,
          codOperativo: a.codOperativo ?? null,
          cuentaNombre: a.cuentaNombre,
          tipo: a.tipo as TipoCuenta,
          orden: a.orden,
        }))
      );

      const filasCalculadas: FilaConciliacion[] = (movimientos ?? []).map((m) => ({
        id: m.id,
        fecha: m.fecha,
        concepto: m.concepto,
        cuentaCodigo: m.cuentaCodigo,
        cuentaNombre: m.cuentaNombre || m.cuentaCodigo,
        tipo: m.tipo as TipoCuenta,
        monto: Number(m.monto),
      }));

      setFilas(filasCalculadas);
      setResumen({
        saldoAnterior: Number(conciliacion.saldoAnterior),
        totalIngresos: Number(conciliacion.totalIngresos),
        totalSalidas: Number(conciliacion.totalSalidas),
        totalGastos: Number(conciliacion.totalGastos),
        subtotal: Number(conciliacion.subtotal),
        totalConciliado: Number(conciliacion.totalConciliado),
      });
    } catch {
      showMessage("error", "Error al cargar los datos del período");
    } finally {
      setLoading(false);
    }
  }, [mes, anio, showMessage]);

  useEffect(() => {
    void cargarDatos();
  }, [cargarDatos]);

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Conciliación Banco</h1>
        <p className="mt-1 text-sm text-gray-500">
          Conciliá los movimientos del extracto por categoría y período mensual.
        </p>
      </div>

      {mensaje && (
        <div
          className={`fixed right-4 top-4 z-[100] flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium shadow-lg transition-all ${
            mensaje.tipo === "ok" ? "bg-emerald-600 text-white" : "bg-red-600 text-white"
          }`}
        >
          {mensaje.tipo === "ok" ? "✓" : "✗"} {mensaje.text}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <CalendarioConciliacion
          mes={mes}
          anio={anio}
          onChange={(m, a) => {
            setMes(m);
            setAnio(a);
          }}
        />
        <button
          type="button"
          onClick={() => setModalAbierto(true)}
          className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-emerald-700"
        >
          <SlidersHorizontal className="h-4 w-4" />
          Conciliar
        </button>
        <BotonesExportar
          filas={filas}
          resumen={resumen}
          mes={mes}
          anio={anio}
          showMessage={showMessage}
          disabled={loading}
        />
        <span className="ml-1 text-sm text-gray-500">
          {MESES_LABEL[mes]} {anio}
        </span>
      </div>

      <VistaPreviaConciliacion
        filas={filas}
        resumen={resumen}
        loading={loading}
        mes={mes}
        anio={anio}
        onEliminados={() => void cargarDatos()}
        showMessage={showMessage}
      />

      {modalAbierto && (
        <ModalConciliar
          mes={mes}
          anio={anio}
          cuentasDisponibles={cuentasDisponibles}
          asignacionesIniciales={asignacionesActuales}
          onClose={() => setModalAbierto(false)}
          onGuardado={() => void cargarDatos()}
          showMessage={showMessage}
        />
      )}
    </div>
  );
}
