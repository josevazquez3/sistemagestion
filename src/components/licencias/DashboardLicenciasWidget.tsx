"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FileCheck } from "lucide-react";
import { formatearFechaLicencia, TIPO_LICENCIA_LABEL, diasTranscurridos } from "@/lib/licencias.utils";

type LicenciaActiva = {
  id: number;
  tipoLicencia: string;
  fechaInicio: string;
  legajo: { id: string; numeroLegajo: number; nombres: string; apellidos: string };
};

export function DashboardLicenciasWidget() {
  const [licencias, setLicencias] = useState<LicenciaActiva[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/licencias/activas")
      .then((r) => r.json())
      .then((data) => {
        setLicencias(data.data || []);
      })
      .catch(() => setLicencias([]))
      .finally(() => setLoading(false));
  }, []);

  const total = licencias.length;
  const tieneActivas = total > 0;

  return (
    <Link href={tieneActivas ? "/rrhh/licencias" : "/rrhh/licencias"}>
      <Card
        className={
          tieneActivas
            ? "rounded-xl border-2 border-amber-400 bg-amber-50 shadow-sm hover:shadow-md transition-shadow"
            : "rounded-xl border shadow-sm hover:shadow-md transition-shadow"
        }
      >
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-gray-600">
            Licencias
          </CardTitle>
          <div className="flex items-center gap-2">
            {tieneActivas && (
              <span className="bg-amber-100 text-amber-700 text-xs font-medium px-2 py-0.5 rounded-full">
                {total} activa{total !== 1 ? "s" : ""}
              </span>
            )}
            <FileCheck className="h-4 w-4 text-[#4CAF50] shrink-0" />
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold text-gray-800">{total}</p>
          <p className="text-sm text-gray-600">
            Empleado{total !== 1 ? "s" : ""} con licencia activa
          </p>
          <CardDescription>Gestión de licencias (ART, enfermedad, estudio, etc.)</CardDescription>
          {loading ? (
            <p className="text-xs text-gray-500 mt-2">Cargando...</p>
          ) : tieneActivas && (
            <ul className="mt-2 space-y-1">
              {licencias.slice(0, 5).map((lic) => (
                <li
                  key={lic.id}
                  className="text-xs text-amber-800 flex flex-wrap items-center gap-1"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0" />
                  {lic.legajo.apellidos}, {lic.legajo.nombres}
                  <span className="text-amber-600">
                    — {TIPO_LICENCIA_LABEL[lic.tipoLicencia] ?? lic.tipoLicencia} · desde {formatearFechaLicencia(new Date(lic.fechaInicio))} ({diasTranscurridos(new Date(lic.fechaInicio))} días)
                  </span>
                </li>
              ))}
              {total > 5 && (
                <li className="text-xs text-amber-600 font-medium">
                  +{total - 5} más...
                </li>
              )}
            </ul>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}
