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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InputFecha } from "@/components/ui/InputFecha";
import { formatearFechaUTC, parsearFechaSegura } from "@/lib/utils/fecha";
import { createExpediente, updateMovimiento } from "@/lib/actions/tsd.actions";
import { TSD_ESTADO_OPTIONS } from "@/lib/tsd/display";

export type ModalIngresarEditContext = {
  expediente: {
    nroExpte: string;
    caratula: string;
    distrito: string;
  };
  movimiento: {
    id: number;
    fecha: Date;
    estado: TsdEstado;
    observacion: string | null;
  };
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  editContext?: ModalIngresarEditContext | null;
  onGuardado: () => void;
  onError: (msg: string) => void;
};

export function ModalIngresarExpte({
  open,
  onOpenChange,
  mode,
  editContext,
  onGuardado,
  onError,
}: Props) {
  const [fecha, setFecha] = useState("");
  const [nroExpte, setNroExpte] = useState("");
  const [caratula, setCaratula] = useState("");
  const [distrito, setDistrito] = useState("");
  const [estado, setEstado] = useState<TsdEstado>("PARA_TRATAR");
  const [observacion, setObservacion] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (mode === "edit" && editContext) {
      setFecha(formatearFechaUTC(new Date(editContext.movimiento.fecha)));
      setNroExpte(editContext.expediente.nroExpte);
      setCaratula(editContext.expediente.caratula);
      setDistrito(editContext.expediente.distrito);
      setEstado(editContext.movimiento.estado);
      setObservacion(editContext.movimiento.observacion ?? "");
    } else {
      setFecha("");
      setNroExpte("");
      setCaratula("");
      setDistrito("");
      setEstado("PARA_TRATAR");
      setObservacion("");
    }
  }, [open, mode, editContext]);

  const handleGuardar = async () => {
    const fd = parsearFechaSegura(fecha.trim());
    if (!fd) {
      onError("La fecha es obligatoria y debe ser válida (DD/MM/YYYY).");
      return;
    }

    if (mode === "create") {
      if (!nroExpte.trim() || !caratula.trim() || !distrito.trim()) {
        onError("Completá Nº Expte., Carátula y Distrito.");
        return;
      }
    }

    setSubmitting(true);
    try {
      if (mode === "edit" && editContext) {
        await updateMovimiento(editContext.movimiento.id, {
          fecha: fd,
          estado,
          observacion: observacion.trim() || null,
        });
      } else {
        await createExpediente({
          fecha: fd,
          nroExpte: nroExpte.trim(),
          caratula: caratula.trim(),
          distrito: distrito.trim(),
          estado,
          observacion: observacion.trim() || null,
        });
      }
      onOpenChange(false);
      onGuardado();
    } catch (e) {
      onError(e instanceof Error ? e.message : "Error al guardar.");
    } finally {
      setSubmitting(false);
    }
  };

  const readonlyExpte = mode === "edit";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "Ingresar expediente" : "Editar movimiento"}
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label htmlFor="tsd-fecha">Fecha</Label>
            <InputFecha id="tsd-fecha" value={fecha} onChange={setFecha} className="h-10 w-full rounded-md border px-3" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="tsd-nro">Nº Expte.</Label>
            <Input
              id="tsd-nro"
              value={nroExpte}
              onChange={(e) => setNroExpte(e.target.value)}
              disabled={readonlyExpte}
              className={readonlyExpte ? "bg-muted" : ""}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="tsd-caratula">Carátula</Label>
            <Input
              id="tsd-caratula"
              value={caratula}
              onChange={(e) => setCaratula(e.target.value)}
              disabled={readonlyExpte}
              className={readonlyExpte ? "bg-muted" : ""}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="tsd-distrito">Distrito</Label>
            <Input
              id="tsd-distrito"
              value={distrito}
              onChange={(e) => setDistrito(e.target.value)}
              disabled={readonlyExpte}
              className={readonlyExpte ? "bg-muted" : ""}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="tsd-estado">Estado</Label>
            <select
              id="tsd-estado"
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
            <Label htmlFor="tsd-obs">Observación</Label>
            <textarea
              id="tsd-obs"
              value={observacion}
              onChange={(e) => setObservacion(e.target.value)}
              rows={3}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              placeholder="Opcional"
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancelar
          </Button>
          <Button type="button" onClick={() => void handleGuardar()} disabled={submitting}>
            {submitting ? "Guardando…" : "Guardar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
