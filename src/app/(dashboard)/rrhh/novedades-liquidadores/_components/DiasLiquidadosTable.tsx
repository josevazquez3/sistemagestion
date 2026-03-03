"use client";

import { useState, useEffect } from "react";
import * as XLSX from "xlsx";

export interface EmpleadoLiquidacion {
  legajoId: string;
  numeroLegajo: number;
  apellidoNombre: string;
  diasTotales: number;
  periodos: string[];
  liquidado: boolean;
  novedadId: string | null;
  primeraFechaDesde?: string;
  primeraFechaHasta?: string;
}

type Props = {
  periodo: string;
  showMessage?: (msg: string, type: "success" | "error") => void;
};

export function DiasLiquidadosTable({ periodo, showMessage }: Props) {
  const [empleados, setEmpleados] = useState<EmpleadoLiquidacion[]>([]);
  const [loading, setLoading] = useState(true);

  const cargarDatos = async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/novedades-liquidadores/dias-liquidados?periodo=${encodeURIComponent(periodo)}`
      );
      const data = await res.json();
      setEmpleados(data.empleados ?? []);
    } catch {
      setEmpleados([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarDatos();
  }, [periodo]);

  const handleLiquidar = async (emp: EmpleadoLiquidacion) => {
    try {
      if (emp.novedadId) {
        const res = await fetch(
          `/api/novedades-liquidadores/liquidar/${emp.novedadId}`,
          { method: "POST" }
        );
        if (res.ok) {
          showMessage?.("Marcado como liquidado.", "success");
          await cargarDatos();
        } else {
          const json = await res.json();
          showMessage?.(json.error || "Error al liquidar.", "error");
        }
      } else {
        const body = {
          legajoId: emp.legajoId,
          tipo: "VACACIONES",
          codigo: 2501,
          fechaDesde: emp.primeraFechaDesde,
          fechaHasta: emp.primeraFechaHasta,
          diasTotal: emp.diasTotales,
          observacion: emp.periodos.join(" | "),
          periodoNombre: `${periodo}__NOVEDADES`,
        };
        const resCreate = await fetch("/api/novedades-liquidadores", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!resCreate.ok) {
          const json = await resCreate.json();
          showMessage?.(json.error || "Error al crear la novedad.", "error");
          return;
        }
        const created = await resCreate.json();
        const resLiq = await fetch(
          `/api/novedades-liquidadores/liquidar/${created.id}`,
          { method: "POST" }
        );
        if (resLiq.ok) {
          showMessage?.("Marcado como liquidado.", "success");
          await cargarDatos();
        } else {
          showMessage?.("Novedad creada pero no se pudo marcar como liquidada.", "error");
          await cargarDatos();
        }
      }
    } catch {
      showMessage?.("Error de conexión.", "error");
    }
  };

  const handleDeshacer = async (novedadId: string) => {
    try {
      const res = await fetch(
        `/api/novedades-liquidadores/deshacer/${novedadId}`,
        { method: "POST" }
      );
      if (res.ok) {
        showMessage?.("Liquidación deshecha.", "success");
        await cargarDatos();
      } else {
        const json = await res.json();
        showMessage?.(json.error || "Error al deshacer.", "error");
      }
    } catch {
      showMessage?.("Error de conexión.", "error");
    }
  };

  const exportarTodosExcel = () => {
    const wb = XLSX.utils.book_new();
    const datos = [
      ["Legajo", "Apellido y Nombre", "Días Totales", "Período(s)", "Estado"],
      ...empleados.map((e) => [
        e.numeroLegajo,
        e.apellidoNombre,
        e.diasTotales,
        e.periodos.join(" | "),
        e.liquidado ? "Liquidado" : "Pendiente",
      ]),
    ];
    const ws = XLSX.utils.aoa_to_sheet(datos);
    ws["!cols"] = [
      { wch: 10 },
      { wch: 35 },
      { wch: 15 },
      { wch: 40 },
      { wch: 15 },
    ];
    XLSX.utils.book_append_sheet(wb, ws, "Días Liquidados");
    XLSX.writeFile(wb, `${periodo}__DIAS_LIQUIDADOS.xlsx`);
  };

  const exportarEmpleadoExcel = (emp: EmpleadoLiquidacion) => {
    const wb = XLSX.utils.book_new();
    const datos = [
      ["Legajo", "Apellido y Nombre", "Días Totales", "Período(s)", "Estado"],
      [
        emp.numeroLegajo,
        emp.apellidoNombre,
        emp.diasTotales,
        emp.periodos.join(" | "),
        emp.liquidado ? "Liquidado" : "Pendiente",
      ],
    ];
    const ws = XLSX.utils.aoa_to_sheet(datos);
    ws["!cols"] = [
      { wch: 10 },
      { wch: 35 },
      { wch: 15 },
      { wch: 40 },
      { wch: 15 },
    ];
    XLSX.utils.book_append_sheet(wb, ws, "Días Liquidados");
    XLSX.writeFile(
      wb,
      `${periodo}__${emp.apellidoNombre.replace(/[^a-zA-Z0-9]/g, "_")}.xlsx`
    );
  };

  if (loading) {
    return (
      <p className="p-4 text-sm text-gray-400">Cargando...</p>
    );
  }

  if (empleados.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-gray-500">
        No hay vacaciones aprobadas para el período seleccionado.
      </p>
    );
  }

  const totalPendiente = empleados
    .filter((e) => !e.liquidado)
    .reduce((acc, e) => acc + e.diasTotales, 0);
  const cantidadPendientes = empleados.filter((e) => !e.liquidado).length;

  return (
    <div>
      <div className="mb-3 flex justify-end">
        <button
          type="button"
          onClick={exportarTodosExcel}
          className="flex items-center gap-2 rounded bg-green-600 px-4 py-2 text-sm text-white hover:bg-green-700"
        >
          Exportar Excel - Todos
        </button>
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full min-w-[700px] border-collapse text-sm">
          <thead>
            <tr className="bg-gray-100">
              <th className="border border-gray-200 px-3 py-2 text-left font-medium text-gray-700">
                Legajo
              </th>
              <th className="border border-gray-200 px-3 py-2 text-left font-medium text-gray-700">
                Apellido y Nombre
              </th>
              <th className="border border-gray-200 px-3 py-2 text-center font-medium text-gray-700">
                Días Aprobados
              </th>
              <th className="border border-gray-200 px-3 py-2 text-left font-medium text-gray-700">
                Período
              </th>
              <th className="border border-gray-200 px-3 py-2 text-center font-medium text-gray-700">
                Estado
              </th>
              <th className="border border-gray-200 px-3 py-2 text-center font-medium text-gray-700">
                Acciones
              </th>
            </tr>
          </thead>
          <tbody>
            {empleados.map((emp) => (
              <tr key={emp.legajoId} className="hover:bg-gray-50">
                <td className="border border-gray-200 px-3 py-2">{emp.numeroLegajo}</td>
                <td className="border border-gray-200 px-3 py-2 font-medium">
                  {emp.apellidoNombre}
                </td>
                <td className="border border-gray-200 px-3 py-2 text-center">
                  <span className="text-base font-bold text-red-600">
                    {emp.diasTotales} días
                  </span>
                </td>
                <td className="border border-gray-200 px-3 py-2 text-xs text-gray-600">
                  {emp.periodos.join(" | ")}
                </td>
                <td className="border border-gray-200 px-3 py-2 text-center">
                  <span
                    className={`font-semibold ${
                      emp.liquidado ? "text-green-600" : "text-red-600"
                    }`}
                  >
                    {emp.liquidado ? "✓ Liquidado" : "Pendiente"}
                  </span>
                </td>
                <td className="border border-gray-200 px-3 py-2">
                  <div className="flex flex-wrap items-center justify-center gap-2">
                    {!emp.liquidado ? (
                      <button
                        type="button"
                        onClick={() => handleLiquidar(emp)}
                        className="whitespace-nowrap rounded bg-green-600 px-3 py-1.5 text-xs text-white hover:bg-green-700"
                      >
                        ✓ Liquidado
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() =>
                          emp.novedadId && handleDeshacer(emp.novedadId)
                        }
                        className="whitespace-nowrap rounded bg-gray-400 px-3 py-1.5 text-xs text-white hover:bg-gray-500"
                      >
                        ↩ Deshacer
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => exportarEmpleadoExcel(emp)}
                      className="rounded border border-green-600 px-2 py-1.5 text-xs text-green-600 hover:bg-green-50"
                      title="Exportar a Excel"
                    >
                      XLS
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-gray-50 font-semibold">
              <td
                colSpan={2}
                className="border border-gray-200 px-3 py-2 text-right text-gray-600"
              >
                Total días a liquidar:
              </td>
              <td className="border border-gray-200 px-3 py-2 text-center text-base text-red-600">
                {totalPendiente} días
              </td>
              <td
                colSpan={3}
                className="border border-gray-200 px-3 py-2 text-xs text-gray-400"
              >
                {cantidadPendientes} empleados pendientes
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
