"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Search } from "lucide-react";

interface FiltrosHistorialProps {
  aniosDisponibles: number[];
  anioActual?: number;
  estadoActual?: string;
  legajoId?: string;
  onFiltrar: (anio?: number, estado?: string) => void;
}

export function FiltrosHistorial({
  aniosDisponibles,
  anioActual,
  estadoActual,
  legajoId,
  onFiltrar,
}: FiltrosHistorialProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [anio, setAnio] = useState<string>("");
  const [estado, setEstado] = useState<string>("TODOS");

  useEffect(() => {
    const anioParam = searchParams.get("anio");
    const estadoParam = searchParams.get("estado");
    if (anioParam) {
      const n = parseInt(anioParam, 10);
      setAnio(isNaN(n) ? "" : String(n));
    } else {
      setAnio(anioActual !== undefined ? String(anioActual) : "");
    }
    if (estadoParam && ["PENDIENTE", "APROBADA", "BAJA", "TODOS"].includes(estadoParam)) {
      setEstado(estadoParam);
    } else {
      setEstado(estadoActual ?? "TODOS");
    }
  }, [searchParams, anioActual, estadoActual]);

  const handleBuscar = () => {
    const anioNum = anio ? parseInt(anio, 10) : undefined;
    const estadoVal = estado === "TODOS" ? undefined : estado;
    const params = new URLSearchParams();
    if (legajoId) params.set("legajoId", legajoId);
    if (anioNum) params.set("anio", String(anioNum));
    if (estadoVal) params.set("estado", estadoVal);
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
    onFiltrar(anioNum, estadoVal);
  };

  return (
    <div className="flex flex-wrap gap-3">
      <select
        value={anio}
        onChange={(e) => setAnio(e.target.value)}
        className="h-9 rounded-md border border-input bg-background px-3 text-sm"
      >
        <option value="">Todos los años</option>
        {[
          ...new Set([
            ...aniosDisponibles,
            ...(anioActual !== undefined ? [anioActual] : []),
          ]),
        ]
          .sort((a, b) => b - a)
          .map((a) => (
            <option key={a} value={String(a)}>
              {a}
            </option>
          ))}
      </select>
      <select
        value={estado}
        onChange={(e) => setEstado(e.target.value)}
        className="h-9 rounded-md border border-input bg-background px-3 text-sm"
      >
        <option value="TODOS">Todos</option>
        <option value="PENDIENTE">Pendiente</option>
        <option value="APROBADA">Aprobada</option>
        <option value="BAJA">Baja</option>
      </select>
      <Button
        onClick={handleBuscar}
        size="sm"
        className="bg-[#4CAF50] hover:bg-[#388E3C]"
      >
        <Search className="h-4 w-4 mr-2" />
        Buscar
      </Button>
    </div>
  );
}
