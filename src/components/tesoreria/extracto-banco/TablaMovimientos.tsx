"use client";

import { useEffect, useRef } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Pencil, Trash2, Loader2, Hash } from "lucide-react";
import { formatearImporteAR } from "@/lib/parsearExtracto";

const TZ = "America/Argentina/Buenos_Aires";

function formatFecha(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("es-AR", {
      timeZone: TZ,
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return iso.slice(0, 10);
  }
}

export type MovimientoExtracto = {
  id: number;
  fecha: string;
  sucOrigen: string | null;
  descSucursal: string | null;
  codOperativo: string | null;
  codOperativoEditado?: boolean;
  referencia: string | null;
  concepto: string;
  importePesos: number;
  saldoPesos: number;
  cuentaId: number | null;
  cuenta: { id: number; codigo: string; nombre: string } | null;
  importado: boolean;
  creadoEn: string;
  actualizadoEn: string;
};

type TablaMovimientosProps = {
  data: MovimientoExtracto[];
  loading: boolean;
  onEditarCuenta: (m: MovimientoExtracto) => void;
  onEditarCodOp: (m: MovimientoExtracto) => void;
  onEliminar: (m: MovimientoExtracto) => void;
  seleccionados: Set<number>;
  onToggleSeleccion: (id: number) => void;
  onToggleTodos: () => void;
};

export function TablaMovimientos({
  data,
  loading,
  onEditarCuenta,
  onEditarCodOp,
  onEliminar,
  seleccionados,
  onToggleSeleccion,
  onToggleTodos,
}: TablaMovimientosProps) {
  const headerCheckboxRef = useRef<HTMLInputElement | null>(null);
  const seleccionadosEnPagina = data.filter((m) => seleccionados.has(m.id)).length;
  const allSelected = data.length > 0 && seleccionadosEnPagina === data.length;
  const isIndeterminate = seleccionadosEnPagina > 0 && seleccionadosEnPagina < data.length;

  useEffect(() => {
    if (headerCheckboxRef.current) {
      headerCheckboxRef.current.indeterminate = isIndeterminate;
    }
  }, [isIndeterminate]);

  return (
    <div className="border rounded-lg overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-8">
              <input
                ref={headerCheckboxRef}
                type="checkbox"
                checked={allSelected}
                onChange={onToggleTodos}
                className="rounded"
              />
            </TableHead>
            <TableHead>Fecha</TableHead>
            <TableHead>Suc.</TableHead>
            <TableHead>Desc. Sucursal</TableHead>
            <TableHead>Cód. Op.</TableHead>
            <TableHead>Referencia</TableHead>
            <TableHead>Concepto</TableHead>
            <TableHead className="text-right">Importe</TableHead>
            <TableHead className="text-right">Saldo</TableHead>
            <TableHead>Cuenta</TableHead>
            <TableHead className="text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            <TableRow>
              <TableCell colSpan={11} className="text-center py-8">
                <Loader2 className="h-6 w-6 animate-spin mx-auto text-gray-400" />
              </TableCell>
            </TableRow>
          ) : data.length === 0 ? (
            <TableRow>
              <TableCell colSpan={11} className="text-center py-8 text-gray-500">
                No hay movimientos.
              </TableCell>
            </TableRow>
          ) : (
            data.map((m) => (
              <TableRow key={m.id}>
                <TableCell>
                  <input
                    type="checkbox"
                    checked={seleccionados.has(m.id)}
                    onChange={() => onToggleSeleccion(m.id)}
                    className="rounded"
                  />
                </TableCell>
                <TableCell className="whitespace-nowrap">{formatFecha(m.fecha)}</TableCell>
                <TableCell className="text-gray-600">{m.sucOrigen ?? "—"}</TableCell>
                <TableCell className="max-w-[120px] truncate" title={m.descSucursal ?? ""}>
                  {m.descSucursal ?? "—"}
                </TableCell>
                <TableCell className={m.codOperativoEditado ? "bg-yellow-100" : undefined}>
                  {m.codOperativo ?? "—"}
                </TableCell>
                <TableCell>{m.referencia ?? "—"}</TableCell>
                <TableCell className="max-w-[180px] truncate" title={m.concepto}>
                  {m.concepto}
                </TableCell>
                <TableCell
                  className={`text-right font-medium whitespace-nowrap ${
                    m.importePesos >= 0 ? "text-green-700" : "text-red-700"
                  }`}
                >
                  $ {formatearImporteAR(m.importePesos)}
                </TableCell>
                <TableCell className="text-right whitespace-nowrap text-gray-700">
                  $ {formatearImporteAR(m.saldoPesos)}
                </TableCell>
                <TableCell>
                  {m.cuenta ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                      {m.cuenta.nombre}
                    </span>
                  ) : (
                    <span className="text-gray-400 text-sm">Sin asignar</span>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center gap-1 justify-end">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0"
                      onClick={() => onEditarCuenta(m)}
                      title="Editar cuenta"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0 text-orange-500 hover:bg-orange-50"
                      onClick={() => onEditarCodOp(m)}
                      title="Editar Código Operativo"
                    >
                      <Hash className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0 text-red-600 hover:bg-red-50"
                      onClick={() => onEliminar(m)}
                      title="Eliminar"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
