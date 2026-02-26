"use client";

import { useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Search } from "lucide-react";

type LegajoOption = {
  id: string;
  apellidos: string;
  nombres: string;
};

interface SelectorEmpleadoAdminProps {
  legajos: LegajoOption[];
  legajoActual: string | null;
}

export function SelectorEmpleadoAdmin({
  legajos,
  legajoActual,
}: SelectorEmpleadoAdminProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [busqueda, setBusqueda] = useState("");
  const [abierto, setAbierto] = useState(false);

  const legajoActualData = legajos.find((l) => l.id === legajoActual);
  const filtrados = legajos.filter((l) => {
    const q = busqueda.toLowerCase().trim();
    if (!q) return true;
    return (
      l.apellidos.toLowerCase().includes(q) ||
      l.nombres.toLowerCase().includes(q)
    );
  });

  const handleSeleccionar = (nuevoLegajoId: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("legajoId", nuevoLegajoId);
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
    setAbierto(false);
    setBusqueda("");
  };

  return (
    <div className="relative">
      <div className="flex gap-2 items-center">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por apellido o nombre..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            onFocus={() => setAbierto(true)}
            className="h-9 pl-9 pr-4 rounded-md border border-input text-sm w-64"
          />
          {abierto && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setAbierto(false)}
              />
              <div className="absolute top-full left-0 z-50 mt-1 w-64 max-h-60 overflow-y-auto rounded-lg border bg-white shadow-lg">
                {filtrados.length === 0 ? (
                  <p className="p-3 text-sm text-gray-500">Sin resultados</p>
                ) : (
                  filtrados.map((l) => (
                    <button
                      key={l.id}
                      type="button"
                      onClick={() => handleSeleccionar(l.id)}
                      className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 ${
                        l.id === legajoActual ? "bg-[#E8F5E9] text-[#388E3C]" : ""
                      }`}
                    >
                      {l.apellidos}, {l.nombres}
                    </button>
                  ))
                )}
              </div>
            </>
          )}
        </div>
        {legajoActualData && (
          <span className="text-sm text-gray-600">
            Empleado: {legajoActualData.apellidos}, {legajoActualData.nombres}
          </span>
        )}
      </div>
    </div>
  );
}
