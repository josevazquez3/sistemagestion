"use client";

import { useState, useMemo, useEffect } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { FileDown, ChevronLeft, ChevronRight } from "lucide-react";
import type { SolicitudHistorial } from "@/app/actions/vacaciones";

const PAGE_SIZE = 10;

function formatearFecha(fecha: Date): string {
  const d = new Date(fecha);
  const dia = d.getDate().toString().padStart(2, "0");
  const mes = (d.getMonth() + 1).toString().padStart(2, "0");
  const anio = d.getFullYear();
  return `${dia}/${mes}/${anio}`;
}

const estadoBadgeClass: Record<string, string> = {
  APROBADA: "bg-green-100 text-green-700",
  PENDIENTE: "bg-amber-100 text-amber-700",
  BAJA: "bg-red-100 text-red-700",
};

const estadoLabel: Record<string, string> = {
  APROBADA: "Aprobada",
  PENDIENTE: "Pendiente",
  BAJA: "Baja",
};

type SortKey = "anio" | "fechaDesde" | "fechaHasta";
type SortDir = "asc" | "desc";

interface TablaHistorialProps {
  solicitudes: SolicitudHistorial[];
  onDescargarDocx: (solicitudId: number) => void;
}

export function TablaHistorial({
  solicitudes,
  onDescargarDocx,
}: TablaHistorialProps) {
  const [sortKey, setSortKey] = useState<SortKey>("fechaDesde");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [page, setPage] = useState(0);

  useEffect(() => {
    setPage(0);
  }, [solicitudes]);

  const sorted = useMemo(() => {
    const list = [...solicitudes];
    list.sort((a, b) => {
      let cmp = 0;
      if (sortKey === "anio") {
        const ay = new Date(a.fechaDesde).getFullYear();
        const by = new Date(b.fechaDesde).getFullYear();
        cmp = ay - by;
      } else if (sortKey === "fechaDesde") {
        cmp = new Date(a.fechaDesde).getTime() - new Date(b.fechaDesde).getTime();
      } else if (sortKey === "fechaHasta") {
        cmp = new Date(a.fechaHasta).getTime() - new Date(b.fechaHasta).getTime();
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return list;
  }, [solicitudes, sortKey, sortDir]);

  const totalPages = Math.ceil(sorted.length / PAGE_SIZE) || 1;
  const paginated = sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
    setPage(0);
  };

  if (solicitudes.length === 0) {
    return (
      <p className="text-gray-500 text-center py-8">
        No hay solicitudes para los filtros seleccionados.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead
                className="cursor-pointer hover:bg-gray-50"
                onClick={() => toggleSort("anio")}
              >
                Año {sortKey === "anio" && (sortDir === "asc" ? "↑" : "↓")}
              </TableHead>
              <TableHead
                className="cursor-pointer hover:bg-gray-50"
                onClick={() => toggleSort("fechaDesde")}
              >
                Desde {sortKey === "fechaDesde" && (sortDir === "asc" ? "↑" : "↓")}
              </TableHead>
              <TableHead
                className="cursor-pointer hover:bg-gray-50"
                onClick={() => toggleSort("fechaHasta")}
              >
                Hasta {sortKey === "fechaHasta" && (sortDir === "asc" ? "↑" : "↓")}
              </TableHead>
              <TableHead>Días</TableHead>
              <TableHead>Restantes</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginated.map((s) => (
              <TableRow key={s.id}>
                <TableCell>
                  {new Date(s.fechaDesde).getFullYear()}
                </TableCell>
                <TableCell>{formatearFecha(s.fechaDesde)}</TableCell>
                <TableCell>{formatearFecha(s.fechaHasta)}</TableCell>
                <TableCell>{s.diasSolicitados}</TableCell>
                <TableCell>{s.diasRestantes}</TableCell>
                <TableCell>
                  <span
                    className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${
                      estadoBadgeClass[s.estado] ?? ""
                    }`}
                  >
                    {estadoLabel[s.estado] ?? s.estado}
                  </span>
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onDescargarDocx(s.id)}
                    title="Descargar DOCX"
                  >
                    <FileDown className="h-4 w-4 mr-1" />
                    Descargar DOCX
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-500">
            Página {page + 1} de {totalPages} ({sorted.length} registros)
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
            >
              Siguiente
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
