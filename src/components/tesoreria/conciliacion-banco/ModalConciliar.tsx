"use client";

import { useState, useEffect } from "react";
import { X, Save, ChevronDown, ChevronUp } from "lucide-react";
import type { CuentaOperativa, AsignacionCuenta, TipoCuenta } from "@/types/conciliacion";

interface Props {
  mes: number;
  anio: number;
  cuentasDisponibles: CuentaOperativa[];
  asignacionesIniciales: AsignacionCuenta[];
  onClose: () => void;
  onGuardado: () => void;
  showMessage: (tipo: "ok" | "error", text: string) => void;
}

type SeccionTipo = TipoCuenta;

const SECCIONES: { tipo: SeccionTipo; label: string }[] = [
  { tipo: "INGRESO", label: "Ingreso" },
  { tipo: "SALIDA", label: "Salida" },
  { tipo: "GASTO", label: "Gastos" },
];

function sectionClasses(tipo: SeccionTipo, expandida: boolean) {
  if (tipo === "INGRESO") {
    return {
      border: expandida ? "border-emerald-200" : "border-gray-200",
      headerBg: expandida ? "bg-emerald-50" : "bg-gray-50 hover:bg-gray-100",
      title: "text-emerald-700",
      badge: "border-emerald-200 bg-emerald-100 text-emerald-700",
      rowOn: "border-emerald-200 bg-emerald-50",
      btn: "bg-emerald-600 text-white hover:bg-emerald-700",
    };
  }
  if (tipo === "SALIDA") {
    return {
      border: expandida ? "border-red-200" : "border-gray-200",
      headerBg: expandida ? "bg-red-50" : "bg-gray-50 hover:bg-gray-100",
      title: "text-red-700",
      badge: "border-red-200 bg-red-100 text-red-700",
      rowOn: "border-red-200 bg-red-50",
      btn: "bg-red-600 text-white hover:bg-red-700",
    };
  }
  return {
    border: expandida ? "border-amber-200" : "border-gray-200",
    headerBg: expandida ? "bg-amber-50" : "bg-gray-50 hover:bg-gray-100",
    title: "text-amber-700",
    badge: "border-amber-200 bg-amber-100 text-amber-700",
    rowOn: "border-amber-200 bg-amber-50",
    btn: "bg-amber-600 text-white hover:bg-amber-700",
  };
}

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

function CuentaRow({
  cuenta,
  tipo,
  checked,
  editando,
  st,
  onToggle,
}: {
  cuenta: CuentaOperativa;
  tipo: SeccionTipo;
  checked: boolean;
  editando: boolean;
  st: ReturnType<typeof sectionClasses>;
  onToggle: () => void;
}) {
  const codCol = (cuenta.codigo || cuenta.cuentaCodigo || "—").trim() || "—";
  const codOp = (cuenta.codOperativo ?? "").trim();
  const mostrarOp = codOp && codOp !== codCol;

  return (
    <label
      className={`flex cursor-pointer select-none items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors ${
        editando
          ? checked
            ? st.rowOn
            : "border-transparent hover:bg-gray-50"
          : "cursor-not-allowed border-transparent opacity-60"
      }`}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={!editando}
        onChange={onToggle}
        className="h-4 w-4 flex-shrink-0 cursor-pointer"
        style={{
          accentColor:
            tipo === "INGRESO" ? "#059669" : tipo === "SALIDA" ? "#dc2626" : "#d97706",
        }}
      />
      <span className="w-10 flex-shrink-0 text-right font-mono text-xs font-semibold text-gray-700">
        {codCol}
      </span>
      <span className="flex-shrink-0 select-none text-gray-200">│</span>
      <span
        className="w-32 flex-shrink-0 overflow-hidden text-ellipsis whitespace-nowrap font-mono text-xs text-gray-500"
        title={mostrarOp ? codOp : undefined}
      >
        {mostrarOp ? codOp : "—"}
      </span>
      <span className="min-w-0 flex-1 truncate text-sm text-gray-700" title={cuenta.nombre}>
        {cuenta.nombre}
      </span>
    </label>
  );
}

export function ModalConciliar({
  mes,
  anio,
  cuentasDisponibles,
  asignacionesIniciales,
  onClose,
  onGuardado,
  showMessage,
}: Props) {
  const [seleccionadas, setSeleccionadas] = useState<Record<SeccionTipo, Set<string>>>(() => ({
    INGRESO: new Set(
      asignacionesIniciales.filter((a) => a.tipo === "INGRESO").map((a) => a.cuentaCodigo)
    ),
    SALIDA: new Set(
      asignacionesIniciales.filter((a) => a.tipo === "SALIDA").map((a) => a.cuentaCodigo)
    ),
    GASTO: new Set(
      asignacionesIniciales.filter((a) => a.tipo === "GASTO").map((a) => a.cuentaCodigo)
    ),
  }));

  useEffect(() => {
    setSeleccionadas({
      INGRESO: new Set(
        asignacionesIniciales.filter((a) => a.tipo === "INGRESO").map((a) => a.cuentaCodigo)
      ),
      SALIDA: new Set(
        asignacionesIniciales.filter((a) => a.tipo === "SALIDA").map((a) => a.cuentaCodigo)
      ),
      GASTO: new Set(
        asignacionesIniciales.filter((a) => a.tipo === "GASTO").map((a) => a.cuentaCodigo)
      ),
    });
  }, [asignacionesIniciales]);

  const [expandidas, setExpandidas] = useState<Record<SeccionTipo, boolean>>({
    INGRESO: true,
    SALIDA: false,
    GASTO: false,
  });

  const [editando, setEditando] = useState<Record<SeccionTipo, boolean>>({
    INGRESO: true,
    SALIDA: false,
    GASTO: false,
  });

  const [guardando, setGuardando] = useState(false);

  const cuentasUsadas = (tipoActual: SeccionTipo): Set<string> => {
    const usadas = new Set<string>();
    (Object.keys(seleccionadas) as SeccionTipo[]).forEach((tipo) => {
      if (tipo !== tipoActual) {
        seleccionadas[tipo].forEach((c) => usadas.add(c));
      }
    });
    return usadas;
  };

  const toggleCuenta = (tipo: SeccionTipo, cuentaCodigo: string) => {
    if (!editando[tipo]) return;
    setSeleccionadas((prev) => {
      const nuevo = new Set(prev[tipo]);
      if (nuevo.has(cuentaCodigo)) nuevo.delete(cuentaCodigo);
      else nuevo.add(cuentaCodigo);
      return { ...prev, [tipo]: nuevo };
    });
  };

  const handleGuardarSeccion = (tipo: SeccionTipo) => {
    setEditando((prev) => ({ ...prev, [tipo]: false }));
    const idx = SECCIONES.findIndex((s) => s.tipo === tipo);
    if (idx < SECCIONES.length - 1) {
      const siguiente = SECCIONES[idx + 1].tipo;
      setExpandidas((prev) => ({ ...prev, [siguiente]: true }));
      setEditando((prev) => ({ ...prev, [siguiente]: true }));
    }
  };

  const handleGuardarTodo = async () => {
    setGuardando(true);
    try {
      const asignaciones: AsignacionCuenta[] = [];
      let orden = 0;
      for (const { tipo } of SECCIONES) {
        for (const cuentaCodigo of seleccionadas[tipo]) {
          const cuenta = cuentasDisponibles.find((c) => c.cuentaCodigo === cuentaCodigo);
          const asigIni = asignacionesIniciales.find((a) => a.cuentaCodigo === cuentaCodigo);
          const codOpLargo =
            (cuenta?.codOperativo && cuenta.codOperativo.trim()) ||
            (asigIni?.codOperativo && String(asigIni.codOperativo).trim()) ||
            "";
          let cuentaNombre =
            (cuenta?.nombre &&
            cuenta.nombre.trim() !== cuentaCodigo &&
            cuenta.nombre !== codOpLargo
              ? cuenta.nombre
              : "") ||
            (asigIni?.cuentaNombre &&
            asigIni.cuentaNombre.trim() !== cuentaCodigo &&
            asigIni.cuentaNombre !== codOpLargo
              ? asigIni.cuentaNombre
              : "") ||
            cuenta?.nombre ||
            asigIni?.cuentaNombre ||
            cuentaCodigo;

          if (
            cuentaNombre === cuentaCodigo ||
            (codOpLargo && cuentaNombre === codOpLargo) ||
            !cuentaNombre.trim()
          ) {
            cuentaNombre =
              cuenta?.nombre?.trim() || asigIni?.cuentaNombre?.trim() || cuentaCodigo;
          }

          asignaciones.push({
            cuentaCodigo,
            codOperativo: codOpLargo || null,
            cuentaNombre,
            tipo,
            orden: orden++,
          });
        }
      }

      const res = await fetch("/api/tesoreria/conciliacion-banco", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mes, anio, asignaciones }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as { error?: string })?.error || "Error al guardar");

      showMessage("ok", "Conciliación guardada correctamente.");
      onGuardado();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error inesperado";
      showMessage("error", msg);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col rounded-2xl bg-white shadow-2xl">
        <div className="flex flex-shrink-0 items-center justify-between border-b px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              Conciliar — {MESES_LABEL[mes]} {anio}
            </h2>
            <p className="mt-0.5 text-xs text-gray-500">
              Asigná cada cuenta a su categoría. Las cuentas asignadas no aparecen en otras
              categorías.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 transition-colors hover:bg-gray-100"
          >
            <X className="h-5 w-5 text-gray-400" />
          </button>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto px-6 py-4">
          {SECCIONES.map(({ tipo, label }) => {
            const usadas = cuentasUsadas(tipo);
            const disponibles = cuentasDisponibles.filter((c) => !usadas.has(c.cuentaCodigo));
            const cantidad = seleccionadas[tipo].size;
            const exp = expandidas[tipo];
            const st = sectionClasses(tipo, exp);

            return (
              <div
                key={tipo}
                className={`overflow-hidden rounded-xl border-2 transition-colors ${st.border}`}
              >
                <button
                  type="button"
                  onClick={() => setExpandidas((prev) => ({ ...prev, [tipo]: !prev[tipo] }))}
                  className={`flex w-full items-center justify-between px-4 py-3 text-left transition-colors ${st.headerBg}`}
                >
                  <div className="flex items-center gap-3">
                    <span className={`text-sm font-semibold ${st.title}`}>{label}</span>
                    {cantidad > 0 && (
                      <span className={`rounded-full border px-2 py-0.5 text-xs ${st.badge}`}>
                        {cantidad} cuenta{cantidad !== 1 ? "s" : ""} asignada
                        {cantidad !== 1 ? "s" : ""}
                      </span>
                    )}
                  </div>
                  {exp ? (
                    <ChevronUp className="h-4 w-4 text-gray-400" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-gray-400" />
                  )}
                </button>

                {exp && (
                  <div className="p-4">
                    {disponibles.length === 0 && seleccionadas[tipo].size === 0 ? (
                      <p className="py-4 text-center text-sm text-gray-400">
                        No hay cuentas disponibles para asignar
                      </p>
                    ) : (
                      <div className="grid max-h-56 grid-cols-1 gap-1 overflow-y-auto">
                        {(disponibles.length > 0 || seleccionadas[tipo].size > 0) && (
                          <div className="mb-1 flex items-center gap-3 border-b border-gray-100 px-3 py-1.5">
                            <span className="w-4 flex-shrink-0" />
                            <span className="w-10 flex-shrink-0 text-right text-xs font-semibold text-gray-400">
                              Cód.
                            </span>
                            <span className="flex-shrink-0 text-gray-100">│</span>
                            <span className="w-32 flex-shrink-0 text-xs font-semibold text-gray-400">
                              Cód. Op.
                            </span>
                            <span className="flex-1 text-xs font-semibold text-gray-400">
                              Nombre de la cuenta
                            </span>
                          </div>
                        )}
                        {disponibles.map((cuenta) => (
                          <CuentaRow
                            key={cuenta.cuentaCodigo}
                            cuenta={cuenta}
                            tipo={tipo}
                            checked={seleccionadas[tipo].has(cuenta.cuentaCodigo)}
                            editando={editando[tipo]}
                            st={st}
                            onToggle={() => toggleCuenta(tipo, cuenta.cuentaCodigo)}
                          />
                        ))}
                        {Array.from(seleccionadas[tipo]).map((cuentaCodigo) => {
                          if (disponibles.some((c) => c.cuentaCodigo === cuentaCodigo)) return null;
                          const cuenta = cuentasDisponibles.find((c) => c.cuentaCodigo === cuentaCodigo);
                          const asig = asignacionesIniciales.find((a) => a.cuentaCodigo === cuentaCodigo);
                          const codOp = (asig?.codOperativo ?? "").trim();
                          const nombreDesdeAsig =
                            asig?.cuentaNombre &&
                            asig.cuentaNombre !== cuentaCodigo &&
                            asig.cuentaNombre !== codOp
                              ? asig.cuentaNombre
                              : "";
                          let nombre =
                            cuenta?.nombre || nombreDesdeAsig || asig?.cuentaNombre || cuentaCodigo;
                          if (nombre === cuentaCodigo || (codOp && nombre === codOp)) {
                            nombre = cuenta?.nombre || asig?.cuentaNombre || "(Sin etiqueta)";
                          }
                          const fila: CuentaOperativa = cuenta ?? {
                            cuentaCodigo,
                            codigo: cuentaCodigo,
                            codOperativo: codOp || "",
                            nombre,
                          };
                          return (
                            <CuentaRow
                              key={`sel-${cuentaCodigo}`}
                              cuenta={fila}
                              tipo={tipo}
                              checked
                              editando={editando[tipo]}
                              st={st}
                              onToggle={() => toggleCuenta(tipo, cuentaCodigo)}
                            />
                          );
                        })}
                      </div>
                    )}

                    <div className="mt-3 flex justify-end gap-2 border-t border-gray-100 pt-3">
                      {editando[tipo] ? (
                        <button
                          type="button"
                          onClick={() => handleGuardarSeccion(tipo)}
                          className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs transition-colors ${st.btn}`}
                        >
                          <Save className="h-3.5 w-3.5" />
                          Guardar {label}
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setEditando((prev) => ({ ...prev, [tipo]: true }))}
                          className="flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-xs text-gray-600 transition-colors hover:bg-gray-50"
                        >
                          Editar {label}
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex flex-shrink-0 items-center justify-between rounded-b-2xl border-t bg-gray-50 px-6 py-4">
          <p className="text-xs text-gray-500">
            Los totales se recalculan con los movimientos del extracto del período.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm transition-colors hover:bg-gray-100"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleGuardarTodo}
              disabled={guardando}
              className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
            >
              {guardando ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  Guardando...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  Conciliar
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
