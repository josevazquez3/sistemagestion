"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ClipboardList } from "lucide-react";

type ResumenPayload = {
  mes: number;
  anio: number;
  cantidad: number;
  diasTotales: number;
  porTipo: Record<string, number>;
};

/**
 * Resumen del mes actual desde GET /api/dashboard/rrhh-novedades-resumen
 * (backend: prisma.novedadLiquidacion, liquidado: false, diasTotal).
 */
export function RrhhNovedadesResumenCard() {
  const [data, setData] = useState<ResumenPayload | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/dashboard/rrhh-novedades-resumen", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((res: ResumenPayload | null) => {
        if (!cancelled) setData(res);
      })
      .catch(() => {
        if (!cancelled) setData(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <Link href="/rrhh/novedades-liquidadores">
      <Card className="rounded-xl border shadow-sm hover:shadow-md transition-shadow">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-gray-600">Recursos Humanos</CardTitle>
          <ClipboardList className="h-4 w-4 text-[#4CAF50] shrink-0" />
        </CardHeader>
        <CardContent>
          <p className="text-lg font-bold text-gray-800">Novedades · mes actual</p>
          <CardDescription>No liquidadas (liquidado: false)</CardDescription>
          {loading ? (
            <p className="mt-2 text-xs text-gray-500">Cargando…</p>
          ) : data ? (
            <p className="mt-2 text-sm text-gray-700">
              {data.cantidad} registro{data.cantidad !== 1 ? "s" : ""} · {data.diasTotales} día
              {data.diasTotales !== 1 ? "s" : ""} (suma diasTotal)
            </p>
          ) : (
            <p className="mt-2 text-xs text-gray-500">Sin datos.</p>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}
