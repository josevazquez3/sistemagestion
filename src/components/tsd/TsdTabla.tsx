"use client";

import type { TsdMovimiento } from "@prisma/client";
import { Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { TsdExpedienteConMovimientos } from "@/lib/actions/tsd.actions";
import { deleteMovimiento, setExpedienteFinalizado } from "@/lib/actions/tsd.actions";
import { cn } from "@/lib/utils";
import { formatTsdFecha, tsdEstadoBadgeClass, tsdEstadoLabel } from "@/lib/tsd/display";
import type { ModalIngresarEditContext } from "@/components/tsd/ModalIngresarExpte";
import type { ExpedienteSeguimientoRef } from "@/components/tsd/ModalSeguimiento";

export type TsdVistaFila = {
  expediente: TsdExpedienteConMovimientos;
  movimiento: TsdMovimiento;
  rowSpan: number;
  isFirstInGroup: boolean;
};

export function buildVistaFilas(expedientes: TsdExpedienteConMovimientos[]): TsdVistaFila[] {
  const out: TsdVistaFila[] = [];
  for (const ex of expedientes) {
    const movs = ex.movimientos;
    const n = movs.length;
    if (n === 0) continue;
    movs.forEach((mov, i) => {
      out.push({
        expediente: ex,
        movimiento: mov,
        rowSpan: n,
        isFirstInGroup: i === 0,
      });
    });
  }
  return out;
}

type Props = {
  expedientes: TsdExpedienteConMovimientos[];
  onEditar: (ctx: ModalIngresarEditContext) => void;
  onSeguimiento: (ex: ExpedienteSeguimientoRef) => void;
  onChanged: () => void;
  onError: (msg: string) => void;
  onOk: (msg: string) => void;
};

export function TsdTabla({ expedientes, onEditar, onSeguimiento, onChanged, onError, onOk }: Props) {
  const filas = buildVistaFilas(expedientes);

  const eliminar = async (movimientoId: number) => {
    if (!confirm("¿Eliminar este movimiento? Si era el único, se elimina el expediente.")) return;
    try {
      await deleteMovimiento(movimientoId);
      onOk("Movimiento eliminado.");
      onChanged();
    } catch (e) {
      onError(e instanceof Error ? e.message : "Error al eliminar.");
    }
  };

  if (filas.length === 0) {
    return (
      <p className="text-muted-foreground text-sm py-8 text-center border rounded-lg bg-muted/20">
        No hay expedientes para mostrar. Ingresá uno o ajustá el buscador.
      </p>
    );
  }

  return (
    <Table containerClassName="relative w-full overflow-x-auto rounded-lg border">
      <TableHeader>
        <TableRow className="bg-muted/50">
          <TableHead className="whitespace-nowrap">Fecha</TableHead>
          <TableHead className="whitespace-nowrap">Nº Expte.</TableHead>
          <TableHead>Carátula</TableHead>
          <TableHead className="whitespace-nowrap">Distrito</TableHead>
          <TableHead className="whitespace-nowrap">Estado</TableHead>
          <TableHead className="text-right whitespace-nowrap">Acciones</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {filas.map((f) => (
          <TableRow
            key={f.movimiento.id}
            className={cn(
              "hover:bg-muted/30",
              f.expediente.finalizado && "bg-[#E8F5E9] hover:bg-[#E8F5E9]"
            )}
          >
            <TableCell className="whitespace-nowrap">{formatTsdFecha(new Date(f.movimiento.fecha))}</TableCell>
            {f.isFirstInGroup ? (
              <>
                <TableCell rowSpan={f.rowSpan} className="align-top font-medium whitespace-nowrap border-r">
                  {f.expediente.nroExpte}
                </TableCell>
                <TableCell rowSpan={f.rowSpan} className="align-top max-w-[200px] border-r">
                  {f.expediente.caratula}
                </TableCell>
                <TableCell rowSpan={f.rowSpan} className="align-top whitespace-nowrap border-r">
                  {f.expediente.distrito}
                </TableCell>
              </>
            ) : null}
            <TableCell>
              <span
                className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${tsdEstadoBadgeClass(f.movimiento.estado)}`}
              >
                {tsdEstadoLabel(f.movimiento.estado)}
              </span>
            </TableCell>
            <TableCell className="text-right">
              <div className="flex flex-wrap justify-end gap-1">
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 disabled:cursor-not-allowed disabled:opacity-50"
                  title={
                    f.expediente.finalizado
                      ? "No se puede editar: expediente finalizado"
                      : "Editar"
                  }
                  disabled={f.expediente.finalizado}
                  onClick={() =>
                    onEditar({
                      expediente: {
                        nroExpte: f.expediente.nroExpte,
                        caratula: f.expediente.caratula,
                        distrito: f.expediente.distrito,
                      },
                      movimiento: {
                        id: f.movimiento.id,
                        fecha: new Date(f.movimiento.fecha),
                        estado: f.movimiento.estado,
                        observacion: f.movimiento.observacion,
                      },
                    })
                  }
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-8 disabled:cursor-not-allowed disabled:opacity-50"
                  title={
                    f.expediente.finalizado
                      ? "No disponible: expediente finalizado"
                      : "Seguimiento del expediente"
                  }
                  disabled={f.expediente.finalizado}
                  onClick={() =>
                    onSeguimiento({
                      id: f.expediente.id,
                      nroExpte: f.expediente.nroExpte,
                      caratula: f.expediente.caratula,
                      distrito: f.expediente.distrito,
                    })
                  }
                >
                  Seguimiento
                </Button>
                {f.isFirstInGroup ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className={
                      f.expediente.finalizado
                        ? "h-8 border-[#388E3C] text-[#388E3C] bg-white hover:bg-[#C8E6C9]/50"
                        : "h-8 border-gray-300 text-gray-700 bg-white hover:bg-gray-50"
                    }
                    title={
                      f.expediente.finalizado
                        ? "Marcar el expediente como pendiente (quita el resaltado verde)"
                        : "Marcar expediente como finalizado"
                    }
                    onClick={async () => {
                      try {
                        const next = !f.expediente.finalizado;
                        await setExpedienteFinalizado(f.expediente.id, next);
                        onOk(next ? "Expediente marcado como finalizado." : "Expediente marcado como pendiente.");
                        onChanged();
                      } catch (e) {
                        onError(e instanceof Error ? e.message : "Error al actualizar.");
                      }
                    }}
                  >
                    {f.expediente.finalizado ? "Finalizado" : "Pendiente"}
                  </Button>
                ) : null}
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 text-destructive hover:text-destructive"
                  title="Eliminar"
                  onClick={() => void eliminar(f.movimiento.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
