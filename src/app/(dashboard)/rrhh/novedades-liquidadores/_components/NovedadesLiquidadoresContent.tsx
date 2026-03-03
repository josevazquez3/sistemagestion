"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DiasLiquidadosTable } from "./DiasLiquidadosTable";
import { PlanillaEditable } from "./PlanillaEditable";
import { GuardarModal } from "./GuardarModal";
import { ExportButtons } from "./ExportButtons";
import { Calendar } from "lucide-react";

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

/** Filas que devuelve la API de planilla (códigos como number | null) */
interface FilaPlanillaAPI {
  legajoId: string;
  numeroLegajo: number;
  apellidoNombre: string;
  feriado: number | null;
  diaUtedyc: number | null;
  carpeta: number | null;
  vacaciones: number | null;
  adelanto: number | null;
  otros: number | null;
  observacion: string | null;
  novedadIds: string[];
}

type FilaPlanilla = {
  legajoId: string;
  numeroLegajo: number;
  apellidoNombre: string;
  feriado: string;
  diaUtedyc: string;
  carpeta: string;
  vacaciones: string;
  adelanto: string;
  otros: string;
  observacion: string;
  novedadIds: string[];
};

function toStr(v: string | number | null | undefined): string {
  if (v == null || v === "") return "-";
  return String(v);
}

function normalizeFila(row: FilaPlanillaAPI): FilaPlanilla {
  return {
    legajoId: row.legajoId ?? "",
    numeroLegajo: Number(row.numeroLegajo) || 0,
    apellidoNombre: row.apellidoNombre ?? "",
    feriado: toStr(row.feriado),
    diaUtedyc: toStr(row.diaUtedyc),
    carpeta: toStr(row.carpeta),
    vacaciones: toStr(row.vacaciones),
    adelanto: toStr(row.adelanto),
    otros: toStr(row.otros),
    observacion: row.observacion != null ? String(row.observacion) : "-",
    novedadIds: row.novedadIds ?? [],
  };
}

export function NovedadesLiquidadoresContent() {
  const [periodoSeleccionado, setPeriodoSeleccionado] = useState(() =>
    new Date().toISOString().slice(0, 7)
  );
  const [pickerOpen, setPickerOpen] = useState(false);
  const [añoPicker, setAñoPicker] = useState(() => new Date().getFullYear());
  const pickerRef = useRef<HTMLDivElement>(null);

  const [planilla, setPlanilla] = useState<FilaPlanilla[]>([]);
  const [planillaLoading, setPlanillaLoading] = useState(true);
  const [guardarOpen, setGuardarOpen] = useState(false);
  const [mensaje, setMensaje] = useState<{ tipo: "ok" | "error"; text: string } | null>(null);

  useEffect(() => {
    if (!pickerOpen) return;
    const [y] = periodoSeleccionado.split("-").map(Number);
    setAñoPicker(y);
  }, [pickerOpen, periodoSeleccionado]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setPickerOpen(false);
      }
    }
    if (pickerOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [pickerOpen]);

  const fetchPlanilla = useCallback(async () => {
    setPlanillaLoading(true);
    try {
      const res = await fetch(
        `/api/novedades-liquidadores/planilla?periodo=${encodeURIComponent(periodoSeleccionado)}`
      );
      const json = await res.json();
      if (res.ok) {
        const data: FilaPlanillaAPI[] = Array.isArray(json.data) ? json.data : [];
        setPlanilla(data.map(normalizeFila));
      }
    } catch {
      setPlanilla([]);
    } finally {
      setPlanillaLoading(false);
    }
  }, [periodoSeleccionado]);

  useEffect(() => {
    fetchPlanilla();
  }, [fetchPlanilla]);

  useEffect(() => {
    if (!mensaje) return;
    const t = setTimeout(() => setMensaje(null), 4000);
    return () => clearTimeout(t);
  }, [mensaje]);

  const showMessage = useCallback((msg: string, type: "success" | "error") => {
    setMensaje({ tipo: type === "success" ? "ok" : "error", text: msg });
  }, []);

  const diasTotalesPlanilla = planilla.reduce((acc, f) => {
    const vac = f.vacaciones !== "-" ? 1 : 0;
    const dia = f.diaUtedyc !== "-" ? 1 : 0;
    const fer = f.feriado !== "-" ? 1 : 0;
    const car = f.carpeta !== "-" ? 1 : 0;
    const adel = f.adelanto !== "-" ? 1 : 0;
    const ot = f.otros !== "-" ? 1 : 0;
    return acc + vac + dia + fer + car + adel + ot;
  }, 0);

  const periodoLabel = (() => {
    if (!periodoSeleccionado || !/^\d{4}-\d{2}$/.test(periodoSeleccionado))
      return "";
    const [año, mes] = periodoSeleccionado.split("-").map(Number);
    return new Date(año, mes - 1, 1).toLocaleDateString("es-AR", {
      month: "long",
      year: "numeric",
    });
  })();

  const seleccionarMes = (mes: number) => {
    const valor = `${añoPicker}-${String(mes).padStart(2, "0")}`;
    setPeriodoSeleccionado(valor);
    setPickerOpen(false);
  };

  const esteMes = () => {
    const hoy = new Date();
    setPeriodoSeleccionado(
      `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}`
    );
    setPickerOpen(false);
  };

  return (
    <div className="space-y-6">
      <div className="relative flex flex-wrap items-center gap-3" ref={pickerRef}>
        <label className="font-medium text-gray-700">Período:</label>
        <button
          type="button"
          onClick={() => setPickerOpen((o) => !o)}
          className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-base font-medium text-gray-800 shadow-sm hover:bg-gray-50"
        >
          <Calendar className="h-5 w-5 text-gray-500" />
          {periodoLabel || "Seleccionar mes"}
        </button>
        {periodoLabel && (
          <span className="text-base capitalize text-gray-500">{periodoLabel}</span>
        )}

        {pickerOpen && (
          <div className="absolute left-0 top-full z-50 mt-2 w-[320px] rounded-xl border border-gray-200 bg-white p-4 shadow-lg">
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
                const mes = i + 1;
                const valor = `${añoPicker}-${String(mes).padStart(2, "0")}`;
                const activo = periodoSeleccionado === valor;
                return (
                  <button
                    key={mes}
                    type="button"
                    onClick={() => seleccionarMes(mes)}
                    className={`rounded-lg px-3 py-3 text-base font-medium transition-colors ${
                      activo
                        ? "bg-blue-600 text-white"
                        : "bg-gray-100 text-gray-800 hover:bg-gray-200"
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
                Borrar
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
      </div>

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
        <CardHeader>
          <CardTitle>Días Liquidados</CardTitle>
        </CardHeader>
        <CardContent>
          <DiasLiquidadosTable
            periodo={periodoSeleccionado}
            showMessage={showMessage}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-4">
          <CardTitle>Vista Previa de Planilla</CardTitle>
          <div className="flex flex-wrap gap-2">
            <ExportButtons planilla={planilla} />
            <button
              type="button"
              onClick={() => setGuardarOpen(true)}
              className="inline-flex items-center justify-center rounded-md bg-[#4CAF50] px-4 py-2 text-sm font-medium text-white hover:bg-[#388E3C]"
            >
              Guardar Planilla
            </button>
          </div>
        </CardHeader>
        <CardContent>
          <PlanillaEditable
            planilla={planilla}
            loading={planillaLoading}
            onPlanillaChange={setPlanilla}
            onRefresh={fetchPlanilla}
          />
        </CardContent>
      </Card>

      <GuardarModal
        open={guardarOpen}
        onOpenChange={setGuardarOpen}
        diasTotales={diasTotalesPlanilla}
        planilla={planilla}
        periodo={periodoSeleccionado}
        onSuccess={() => {
          fetchPlanilla();
        }}
        showMessage={showMessage}
      />
    </div>
  );
}
