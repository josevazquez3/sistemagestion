"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { TotalesAnio } from "@/app/actions/vacaciones";

const VALOR_NULL = "—";

interface TarjetaTotalesAnioProps {
  totales: TotalesAnio;
}

export function TarjetaTotalesAnio({ totales }: TarjetaTotalesAnioProps) {
  const anioActual = new Date().getFullYear();
  const esAnioActual = totales.anio === anioActual;

  return (
    <Card
      className={`overflow-hidden ${esAnioActual ? "border-green-500 border-2" : "border-gray-200"}`}
    >
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-bold">
          AÑO {totales.anio}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <div>
            <span className="text-gray-500">Disponibles:</span>{" "}
            {totales.diasDisponibles !== null ? totales.diasDisponibles : VALOR_NULL}
          </div>
          <div>
            <span className="text-gray-500">Usados:</span> {totales.diasUsados}
          </div>
          <div>
            <span className="text-gray-500">Pendientes:</span>{" "}
            <span className="text-amber-600 font-medium">
              {totales.diasPendientes}
            </span>
          </div>
          <div>
            <span className="text-gray-500">Aprobados:</span>{" "}
            <span className="text-green-600 font-medium">
              {totales.diasAprobados}
            </span>
          </div>
          <div>
            <span className="text-gray-500">Dados de baja:</span>{" "}
            <span className="text-red-600 font-medium">
              {totales.diasBaja}
            </span>
          </div>
          <div>
            <span className="text-gray-500">Restantes:</span>{" "}
            {totales.diasRestantes !== null ? totales.diasRestantes : VALOR_NULL}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
