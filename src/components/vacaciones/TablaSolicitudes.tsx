"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Pencil, Trash2, FileDown } from "lucide-react";
import { formatearFecha } from "@/lib/vacaciones.utils";

export type EstadoVacaciones = "PENDIENTE" | "APROBADA" | "BAJA";

export interface SolicitudTabla {
  id: number;
  fechaDesde: Date;
  fechaHasta: Date;
  diasSolicitados: number;
  diasRestantes: number;
  estado: EstadoVacaciones;
}

interface TablaSolicitudesProps {
  solicitudes: SolicitudTabla[];
  onEditar: (solicitud: SolicitudTabla) => void;
  onDarDeBaja: (solicitud: SolicitudTabla) => void;
  onDescargar: (solicitudId: number) => void;
}

const estadoBadgeClass: Record<EstadoVacaciones, string> = {
  PENDIENTE: "bg-amber-100 text-amber-700",
  APROBADA: "bg-green-100 text-green-700",
  BAJA: "bg-red-100 text-red-700",
};

export function TablaSolicitudes({
  solicitudes,
  onEditar,
  onDarDeBaja,
  onDescargar,
}: TablaSolicitudesProps) {
  if (solicitudes.length === 0) {
    return (
      <p className="text-gray-500 text-center py-8">
        No tenés solicitudes de vacaciones registradas.
      </p>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Desde</TableHead>
          <TableHead>Hasta</TableHead>
          <TableHead>Días</TableHead>
          <TableHead>Restantes</TableHead>
          <TableHead>Estado</TableHead>
          <TableHead className="text-right">Acciones</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {solicitudes.map((s) => (
          <TableRow key={s.id}>
            <TableCell>{formatearFecha(s.fechaDesde)}</TableCell>
            <TableCell>{formatearFecha(s.fechaHasta)}</TableCell>
            <TableCell>{s.diasSolicitados}</TableCell>
            <TableCell>{s.diasRestantes}</TableCell>
            <TableCell>
              <span
                className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${
                  estadoBadgeClass[s.estado]
                }`}
              >
                {s.estado}
              </span>
            </TableCell>
            <TableCell className="text-right">
              <div className="flex justify-end gap-1 items-center">
                {s.estado === "PENDIENTE" && (
                  <>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => onEditar(s)}
                      title="Editar fechas"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => onDarDeBaja(s)}
                      title="Dar de baja"
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => onDescargar(s.id)}
                      title="Descargar DOCX"
                    >
                      <FileDown className="h-4 w-4" />
                    </Button>
                  </>
                )}
                {s.estado === "APROBADA" && (
                  <>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => onDescargar(s.id)}
                      title="Descargar DOCX"
                    >
                      <FileDown className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      disabled
                      title="Solo RRHH o Admin puede cancelar una solicitud aprobada."
                      className="text-gray-400 cursor-not-allowed opacity-60"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </>
                )}
                {s.estado === "BAJA" && <span className="text-gray-400">—</span>}
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
