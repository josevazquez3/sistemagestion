"use client";

import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import type { TipoNota } from "./types";

type BuscadorModelosProps = {
  search: string;
  onSearchChange: (value: string) => void;
  filtroTipo: string;
  onFiltroTipoChange: (value: string) => void;
  filtroEstado: string;
  onFiltroEstadoChange: (value: string) => void;
  tipos: TipoNota[];
};

export function BuscadorModelos({
  search,
  onSearchChange,
  filtroTipo,
  onFiltroTipoChange,
  filtroEstado,
  onFiltroEstadoChange,
  tipos,
}: BuscadorModelosProps) {
  const tiposActivos = tipos.filter((t) => t.activo);

  return (
    <div className="flex flex-wrap gap-3 items-center">
      <div className="relative flex-1 min-w-[200px]">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          placeholder="Buscar por nombre, archivo o tipo..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9"
        />
      </div>
      <select
        value={filtroTipo}
        onChange={(e) => onFiltroTipoChange(e.target.value)}
        className="h-9 rounded-md border border-gray-300 bg-white px-3 text-sm"
      >
        <option value="todos">Todos los tipos</option>
        {tiposActivos.map((t) => (
          <option key={t.id} value={t.id}>
            {t.nombre}
          </option>
        ))}
      </select>
      <select
        value={filtroEstado}
        onChange={(e) => onFiltroEstadoChange(e.target.value)}
        className="h-9 rounded-md border border-gray-300 bg-white px-3 text-sm"
      >
        <option value="todos">Todos</option>
        <option value="activos">Activos</option>
      </select>
    </div>
  );
}
