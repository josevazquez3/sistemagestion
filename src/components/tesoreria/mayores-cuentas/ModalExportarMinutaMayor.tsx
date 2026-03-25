"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { AgrupacionMinuta } from "@/lib/tesoreria/exportMayorMovimientosPeriodo";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onExportar: (agrupacion: AgrupacionMinuta) => void;
  /** Guarda la minuta en Historial Mayores - cuentas; debe lanzar si falla para no cerrar el modal. */
  onGuardarEnHistorial: (agrupacion: AgrupacionMinuta) => Promise<void>;
};

const OPTIONS: { value: AgrupacionMinuta; label: string }[] = [
  { value: "cuenta", label: "Cuenta" },
  { value: "origen", label: "Origen" },
  { value: "concepto", label: "Concepto (agrupa por concepto exacto)" },
  { value: "ninguno", label: "Sin agrupación (lista plana ordenada por fecha)" },
];

export function ModalExportarMinutaMayor({
  open,
  onOpenChange,
  onExportar,
  onGuardarEnHistorial,
}: Props) {
  const [agrupacion, setAgrupacion] = useState<AgrupacionMinuta>("ninguno");
  const [accionEnCurso, setAccionEnCurso] = useState(false);

  useEffect(() => {
    if (open) {
      setAgrupacion("ninguno");
    }
  }, [open]);

  const handleExportar = () => {
    onExportar(agrupacion);
    onOpenChange(false);
  };

  const handleGuardarHistorial = async () => {
    setAccionEnCurso(true);
    try {
      await onGuardarEnHistorial(agrupacion);
      onOpenChange(false);
    } catch {
      /* mensaje en el padre */
    } finally {
      setAccionEnCurso(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Configurar Minuta de Exportación</DialogTitle>
          <DialogDescription>
            Seleccioná el campo por el que querés agrupar los movimientos
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1 py-2" role="radiogroup" aria-label="Agrupación de la minuta">
          {OPTIONS.map((opt) => (
            <label
              key={opt.value}
              className="flex cursor-pointer items-center gap-3 rounded-md border border-transparent px-2 py-2 hover:bg-muted/60 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring"
            >
              <input
                type="radio"
                name="agrupacion-minuta"
                className="h-4 w-4 shrink-0 accent-green-600"
                checked={agrupacion === opt.value}
                onChange={() => setAgrupacion(opt.value)}
              />
              <span className="text-sm text-foreground">{opt.label}</span>
            </label>
          ))}
        </div>
        <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={accionEnCurso}
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            className="bg-sky-500 text-white hover:bg-sky-600"
            disabled={accionEnCurso}
            onClick={() => void handleGuardarHistorial()}
          >
            {accionEnCurso ? "Guardando…" : "Guardar en Historial"}
          </Button>
          <Button
            type="button"
            className="bg-green-600 text-white hover:bg-green-700"
            disabled={accionEnCurso}
            onClick={handleExportar}
          >
            Exportar Minuta
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
