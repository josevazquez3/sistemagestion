"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText } from "lucide-react";

type ProximaReunion = {
  id: number;
  organismo: string;
  fechaReunion: string;
  hora: string | null;
} | null;

type ProximaData = {
  proxima: ProximaReunion;
  totalPendientes: number;
};

function formatearFecha(fecha: Date | string): string {
  return new Date(fecha).toLocaleDateString("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function SecretariaDashboardCard() {
  const [data, setData] = useState<ProximaData | null>(null);

  useEffect(() => {
    fetch("/api/secretaria/agenda/proxima")
      .then((r) => r.json())
      .then(setData)
      .catch(() => setData({ proxima: null, totalPendientes: 0 }));
  }, []);

  const tieneProxima = data?.proxima != null;

  const cardContent = (
    <Card
      className={
        tieneProxima
          ? "rounded-xl border-2 border-yellow-300 bg-yellow-50 shadow-sm hover:shadow-md transition-shadow"
          : "rounded-xl border shadow-sm hover:shadow-md transition-shadow"
      }
    >
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle
          className={`text-sm font-medium ${tieneProxima ? "text-yellow-800" : "text-gray-600"}`}
        >
          Secretaría
        </CardTitle>
        <FileText
          className={`h-4 w-4 shrink-0 ${tieneProxima ? "text-yellow-600" : "text-[#4CAF50]"}`}
        />
      </CardHeader>
      <CardContent>
        {tieneProxima && data?.proxima ? (
          <div>
            <p className="text-xs font-semibold text-yellow-700 uppercase mb-1">
              📅 Próxima reunión
            </p>
            <p className="font-bold text-gray-800 text-sm truncate">{data.proxima.organismo}</p>
            <p className="text-sm text-gray-600">
              {formatearFecha(data.proxima.fechaReunion)}
              {data.proxima.hora && (
                <span className="ml-2 text-yellow-700 font-medium">{data.proxima.hora} hs</span>
              )}
            </p>
            {data.totalPendientes > 1 && (
              <p className="text-xs text-yellow-600 mt-1">
                Y {data.totalPendientes - 1} reunión(es) más pendiente(s)
              </p>
            )}
          </div>
        ) : (
          <>
            <p className="text-2xl font-bold text-gray-800">Módulo</p>
            <CardDescription>Próximamente</CardDescription>
          </>
        )}
      </CardContent>
    </Card>
  );

  return <Link href="/secretaria/agenda">{cardContent}</Link>;
}
