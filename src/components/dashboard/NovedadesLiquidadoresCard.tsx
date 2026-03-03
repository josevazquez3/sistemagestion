"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ClipboardList } from "lucide-react";

type Pendiente = {
  legajoId: string;
  legajo: { id: string; numeroLegajo: number; nombres: string; apellidos: string };
  items: { id: string; tipo: string; diasTotal: number }[];
  diasPendientes: number;
};

export function NovedadesLiquidadoresCard() {
  const [data, setData] = useState<Pendiente[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/novedades-liquidadores/pendientes")
      .then((r) => r.json())
      .then((res) => {
        setData(res.data || []);
      })
      .catch(() => setData([]))
      .finally(() => setLoading(false));
  }, []);

  const total = data.length;
  const tienePendientes = total > 0;
  const tipoLabel: Record<string, string> = {
    VACACIONES: "Vacaciones",
    FERIADO: "Feriado",
    DIA_UTEDYC: "Día UTEDYC",
    CARPETA: "Carpeta",
    ADELANTO: "Adelanto",
    OTROS: "Otros",
  };

  return (
    <Link href="/rrhh/novedades-liquidadores">
      <Card
        className={
          tienePendientes
            ? "rounded-xl border-2 border-amber-400 bg-amber-50 shadow-sm hover:shadow-md transition-shadow"
            : "rounded-xl border shadow-sm hover:shadow-md transition-shadow"
        }
      >
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-gray-600">
            Recursos Humanos
          </CardTitle>
          <div className="flex items-center gap-2">
            {tienePendientes && (
              <span className="bg-amber-100 text-amber-700 text-xs font-medium px-2 py-0.5 rounded-full">
                {total} con días
              </span>
            )}
            <ClipboardList className="h-4 w-4 text-[#4CAF50] shrink-0" />
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold text-gray-800">NOVEDADES LIQUIDADORES</p>
          <p className="text-sm text-gray-600">
            Empleados con días a liquidar
          </p>
          <CardDescription>Planilla de novedades para liquidadores</CardDescription>
          {loading ? (
            <p className="text-xs text-gray-500 mt-2">Cargando...</p>
          ) : tienePendientes ? (
            <ul className="mt-2 space-y-1">
              {data.slice(0, 5).map((p) => (
                <li key={p.legajoId} className="text-xs text-amber-800 flex flex-wrap items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0" />
                  {p.legajo.apellidos}, {p.legajo.nombres}
                  <span className="text-red-600 font-medium">
                    — {p.items[0] ? tipoLabel[p.items[0].tipo] ?? p.items[0].tipo : "Novedad"} · {p.diasPendientes} día{p.diasPendientes !== 1 ? "s" : ""} pendiente{p.diasPendientes !== 1 ? "s" : ""}
                  </span>
                </li>
              ))}
              {total > 5 && (
                <li className="text-xs text-amber-600 font-medium">
                  +{total - 5} más...
                </li>
              )}
            </ul>
          ) : null}
        </CardContent>
      </Card>
    </Link>
  );
}
