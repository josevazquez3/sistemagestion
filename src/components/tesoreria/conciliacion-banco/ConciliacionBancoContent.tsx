"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { SlidersHorizontal, AlertTriangle } from "lucide-react";
import { parsearImporteAR } from "@/lib/parsearExtracto";
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

const ROLES_EDITAR_SALDO = ["TESORERO", "ADMIN", "SUPER_ADMIN"] as const;

export function ConciliacionBancoContent() {
  const { data: session } = useSession();
  const roles = (session?.user as { roles?: string[] })?.roles ?? [];
  const puedeEditarSaldoModal = ROLES_EDITAR_SALDO.some((r) => roles.includes(r));

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
  const [metaSaldo, setMetaSaldo] = useState({
    faltaConfigurarSaldoInicial: false,
    esUsandoSaldoInicial: false,
    hayConciliacionMesPrevio: true,
    saldoInicialConfigurado: false,
  });
  const [inputSaldoInicial, setInputSaldoInicial] = useState("");
  const [guardandoSaldoIni, setGuardandoSaldoIni] = useState(false);

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
        esUsandoSaldoInicial?: boolean;
        saldoInicialConfigurado?: boolean;
        faltaConfigurarSaldoInicial?: boolean;
        hayConciliacionMesPrevio?: boolean;
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
          codOperativo: string;
          cuentaCodigo: string;
          cuentaNombre: string;
          tipo: string;
          monto: number;
        }>;
      };

      setMetaSaldo({
        faltaConfigurarSaldoInicial: !!data.faltaConfigurarSaldoInicial,
        esUsandoSaldoInicial: !!data.esUsandoSaldoInicial,
        hayConciliacionMesPrevio: data.hayConciliacionMesPrevio !== false,
        saldoInicialConfigurado: !!data.saldoInicialConfigurado,
      });

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
        codOperativo: m.codOperativo ?? "—",
        cuentaCodigo: m.cuentaCodigo,
        cuentaNombre:
          m.cuentaNombre && m.cuentaNombre !== "—" && m.cuentaNombre.trim()
            ? m.cuentaNombre
            : "",
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

  const mesAntLabel = `${MESES_LABEL[mes === 1 ? 12 : mes - 1]} ${mes === 1 ? anio - 1 : anio}`;
  const tituloSaldoAnterior =
    metaSaldo.hayConciliacionMesPrevio
      ? `Saldo anterior (${mesAntLabel}):`
      : metaSaldo.saldoInicialConfigurado
        ? "Saldo anterior (inicio de conciliaciones):"
        : "Saldo anterior:";

  const guardarSaldoInicial = async () => {
    const monto = parsearImporteAR(inputSaldoInicial.replace(/\$/g, "").trim() || "0");
    if (Number.isNaN(monto) || monto < 0) {
      showMessage("error", "Ingresá un monto válido.");
      return;
    }
    setGuardandoSaldoIni(true);
    try {
      const res = await fetch("/api/tesoreria/conciliacion-banco/saldo-inicial", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ monto }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((d as { error?: string })?.error || "Error al guardar");
      showMessage("ok", "Saldo inicial guardado. Los totales se recalcularon.");
      setInputSaldoInicial("");
      await cargarDatos();
    } catch (e) {
      showMessage("error", e instanceof Error ? e.message : "Error al guardar");
    } finally {
      setGuardandoSaldoIni(false);
    }
  };

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

      {metaSaldo.faltaConfigurarSaldoInicial && (
        <div className="rounded-xl border-2 border-amber-300 bg-amber-50 p-4 shadow-sm">
          <div className="flex gap-3">
            <AlertTriangle className="h-6 w-6 flex-shrink-0 text-amber-600" />
            <div className="min-w-0 flex-1 space-y-3">
              <p className="text-sm font-semibold text-amber-900">
                No hay conciliación del mes previo ({mesAntLabel}). Ingresá el saldo inicial para
                arrancar la cadena de conciliaciones.
              </p>
              <p className="text-xs text-amber-800/90">
                Este valor se ingresa una sola vez y corresponde al saldo bancario al cierre del mes
                anterior al inicio del sistema en esta herramienta.
              </p>
              <div className="flex flex-wrap items-end gap-3">
                <div>
                  <span className="mb-1 block text-xs font-medium text-amber-900">Monto</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={inputSaldoInicial}
                    onChange={(e) => setInputSaldoInicial(e.target.value)}
                    placeholder="0,00"
                    className="w-44 rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm tabular-nums shadow-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => void guardarSaldoInicial()}
                  disabled={guardandoSaldoIni}
                  className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-amber-700 disabled:opacity-50"
                >
                  {guardandoSaldoIni ? "Guardando…" : "Guardar saldo inicial"}
                </button>
              </div>
            </div>
          </div>
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
        <div
          className={`rounded-xl border px-4 py-2 text-sm ${
            metaSaldo.faltaConfigurarSaldoInicial
              ? "border-amber-200 bg-amber-50"
              : "border-blue-100 bg-blue-50"
          }`}
        >
          <span
            className={`font-medium ${metaSaldo.faltaConfigurarSaldoInicial ? "text-amber-900" : "text-blue-900"}`}
          >
            {tituloSaldoAnterior}{" "}
          </span>
          <span
            className={`font-semibold tabular-nums ${metaSaldo.faltaConfigurarSaldoInicial ? "text-amber-800" : "text-blue-800"}`}
          >
            {new Intl.NumberFormat("es-AR", {
              style: "currency",
              currency: "ARS",
              minimumFractionDigits: 2,
            }).format(resumen.saldoAnterior)}
          </span>
          {metaSaldo.faltaConfigurarSaldoInicial && (
            <p className="mt-1 text-xs text-amber-800">Falta configurar el saldo inicial de arranque.</p>
          )}
        </div>
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
          saldoAnterior={resumen.saldoAnterior}
          puedeEditarSaldo={puedeEditarSaldoModal}
          mesAnteriorLabel={
            metaSaldo.hayConciliacionMesPrevio
              ? mesAntLabel
              : metaSaldo.saldoInicialConfigurado
                ? "Inicio de conciliaciones"
                : "Pendiente — configurar saldo inicial"
          }
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
