"use client";

import { FiltrosHistorial } from "./FiltrosHistorial";
import { TarjetaTotalesAnio } from "./TarjetaTotalesAnio";
import { TablaHistorial } from "./TablaHistorial";
import { BotonesExportacion } from "./BotonesExportacion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { SolicitudHistorial, TotalesAnio } from "@/app/actions/vacaciones";

interface HistorialContentProps {
  solicitudes: SolicitudHistorial[];
  totalesPorAnio: TotalesAnio[];
  aniosDisponibles: number[];
  nombreEmpleado: string;
  legajoId: string | null;
  anio?: number;
  estado?: string;
  esAdmin: boolean;
}

export function HistorialContent({
  solicitudes,
  totalesPorAnio,
  aniosDisponibles,
  nombreEmpleado,
  legajoId,
  anio,
  estado,
  esAdmin,
}: HistorialContentProps) {
  const onDescargarDocx = (solicitudId: number) => {
    window.open(
      `/api/vacaciones/documento/${solicitudId}`,
      "_blank",
      "noopener,noreferrer"
    );
  };

  return (
    <>
      <FiltrosHistorial
        aniosDisponibles={aniosDisponibles}
        anioActual={anio}
        estadoActual={estado}
        legajoId={esAdmin && legajoId ? legajoId : undefined}
        onFiltrar={() => {}}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {totalesPorAnio.map((t) => (
          <TarjetaTotalesAnio key={t.anio} totales={t} />
        ))}
      </div>

      <div className="flex justify-end">
        <BotonesExportacion
          legajoId={esAdmin && legajoId ? legajoId : undefined}
          anio={anio}
          estado={estado}
          nombreEmpleado={nombreEmpleado}
        />
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Detalle de solicitudes</CardTitle>
        </CardHeader>
        <CardContent>
          <TablaHistorial
            solicitudes={solicitudes}
            onDescargarDocx={onDescargarDocx}
          />
        </CardContent>
      </Card>
    </>
  );
}
