"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2 } from "lucide-react";
import { fmtARS } from "@/lib/format";

type TesoreriaResumen = {
  extractoBanco: number | null;
  fondoFijo: number | null;
  cobroCertificaciones: number | null;
  ingresosDistritos: number | null;
};

type CeldaProps = {
  label: string;
  value: number | null;
  loading: boolean;
};

function CeldaMonto({ label, value, loading }: CeldaProps) {
  return (
    <div className="min-w-0">
      <p className="text-sm text-gray-500">{label}</p>
      {loading ? (
        <div className="mt-1 h-7 animate-pulse rounded bg-green-100" aria-hidden />
      ) : (
        <p className="text-base font-bold text-green-700 tabular-nums truncate">
          {value == null ? "$ —" : fmtARS(value)}
        </p>
      )}
    </div>
  );
}

export function TesoreriaDashboardCard({ showBalances }: { showBalances: boolean }) {
  const [data, setData] = useState<TesoreriaResumen | null>(null);
  const [loading, setLoading] = useState(showBalances);

  useEffect(() => {
    if (!showBalances) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetch("/api/dashboard/tesoreria-resumen")
      .then((r) => {
        if (!r.ok) throw new Error("unauthorized");
        return r.json();
      })
      .then((d: TesoreriaResumen) => {
        if (!cancelled) setData(d);
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
  }, [showBalances]);

  return (
    <Card className="rounded-xl border border-green-200 bg-emerald-50 shadow-sm hover:shadow-md transition-shadow">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-gray-600">Tesorería</CardTitle>
        <Building2 className="h-4 w-4 text-[#4CAF50]" />
      </CardHeader>
      <CardContent>
        {showBalances ? (
          <div className="grid grid-cols-2 gap-3">
            <CeldaMonto
              label="Extracto Banco"
              value={data?.extractoBanco ?? null}
              loading={loading}
            />
            <CeldaMonto label="Fondo Fijo" value={data?.fondoFijo ?? null} loading={loading} />
            <CeldaMonto
              label="Cobro Certif."
              value={data?.cobroCertificaciones ?? null}
              loading={loading}
            />
            <CeldaMonto
              label="Ingresos Distritos"
              value={data?.ingresosDistritos ?? null}
              loading={loading}
            />
          </div>
        ) : (
          <CardDescription className="text-gray-600">
            Gestión financiera y extractos. Los montos del mes solo se muestran a usuarios con rol de
            tesorería.
          </CardDescription>
        )}
      </CardContent>
    </Card>
  );
}
