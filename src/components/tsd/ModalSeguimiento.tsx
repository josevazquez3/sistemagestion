"use client";

import { useEffect, useState } from "react";
import type { TsdEstado } from "@prisma/client";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { InputFecha } from "@/components/ui/InputFecha";
import { parsearFechaSegura } from "@/lib/utils/fecha";
import { addMovimiento } from "@/lib/actions/tsd.actions";
import { TSD_ESTADO_OPTIONS } from "@/lib/tsd/display";

export type ExpedienteSeguimientoRef = {
  id: number;
  nroExpte: string;
  caratula: string;
  distrito: string;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  expediente: ExpedienteSeguimientoRef | null;
  onGuardado: () => void;
  onError: (msg: string) => void;
};

export function ModalSeguimiento({ open, onOpenChange, expediente, onGuardado, onError }: Props) {
  const [fecha, setFecha] = useState("");
  const [estado, setEstado] = useState<TsdEstado>("PARA_TRATAR");
  const [observacion, setObservacion] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setFecha("");
      setEstado("PARA_TRATAR");
      setObservacion("");
    }
  }, [open, expediente?.id]);

  const handleGuardar = async () => {
    if (!expediente) return;
    const fd = parsearFechaSegura(fecha.trim());
    if (!fd) {
      onError("La fecha es obligatoria y debe ser válida (DD/MM/YYYY).");
      return;
    }
    setSubmitting(true);
    try {
      await addMovimiento({
        expedienteId: expediente.id,
        fecha: fd,
        estado,
        observacion: observacion.trim() || null,
      });
      onOpenChange(false);
      onGuardado();
    } catch (e) {
      onError(e instanceof Error ? e.message : "Error al guardar el seguimiento.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Seguimiento — Expte. Nº {expediente?.nroExpte ?? ""}</DialogTitle>
        </DialogHeader>

        {expediente && (
          <div className="rounded-lg border bg-muted/40 px-3 py-2 text-sm space-y-1">
            <p>
              <span className="text-muted-foreground">Carátula: </span>
              {expediente.caratula}
            </p>
            <p>
              <span className="text-muted-foreground">Distrito: </span>
              {expediente.distrito}
            </p>
          </div>
        )}

        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label htmlFor="seg-fecha">Fecha</Label>
            <InputFecha id="seg-fecha" value={fecha} onChange={setFecha} className="h-10 w-full rounded-md border px-3" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="seg-estado">Estado</Label>
            <select
              id="seg-estado"
              value={estado}
              onChange={(e) => setEstado(e.target.value as TsdEstado)}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              {TSD_ESTADO_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="seg-obs">Observación</Label>
            <textarea
              id="seg-obs"
              value={observacion}
              onChange={(e) => setObservacion(e.target.value)}
              rows={3}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              placeholder="Opcional"
            />
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancelar
          </Button>
          <Button type="button" onClick={() => void handleGuardar()} disabled={submitting || !expediente}>
            {submitting ? "Guardando…" : "Guardar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
