"use client";

import { useState, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  CalendarioVacaciones,
  type RangoFechas,
  type SolicitudCalendario,
} from "./CalendarioVacaciones";
import { calcularDiasVacaciones } from "@/lib/vacaciones.utils";

interface ModalEditarSolicitudProps {
  open: boolean;
  onClose: () => void;
  onGuardar: (fechaDesde: Date, fechaHasta: Date) => Promise<void>;
  solicitudesExistentes: SolicitudCalendario[];
  diasDisponiblesParaEdicion: number;
}

export function ModalEditarSolicitud({
  open,
  onClose,
  onGuardar,
  solicitudesExistentes,
  diasDisponiblesParaEdicion,
}: ModalEditarSolicitudProps) {
  const [value, setValue] = useState<RangoFechas>([null, null]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const desde = value[0];
  const hasta = value[1];
  const diasSolicitados =
    desde && hasta ? calcularDiasVacaciones(desde, hasta) : 0;
  const diasRestarian = diasDisponiblesParaEdicion - diasSolicitados;
  const canGuardar = desde && hasta && diasRestarian >= 0;

  const handleGuardar = useCallback(async () => {
    if (!desde || !hasta || !canGuardar) return;
    setSaving(true);
    setError(null);
    try {
      await onGuardar(desde, hasta);
      onClose();
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }, [desde, hasta, canGuardar, onGuardar, onClose]);

  const handleOpenChange = useCallback(
    (o: boolean) => {
      if (!o) {
        setValue([null, null]);
        setError(null);
        onClose();
      }
    },
    [onClose]
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Editar fechas de la solicitud</DialogTitle>
          <DialogDescription>
            Seleccioná el nuevo rango de fechas para tu solicitud.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <CalendarioVacaciones
            value={value}
            onChange={setValue}
            solicitudes={solicitudesExistentes}
            disabled={false}
          />
          <div className="text-sm">
            <span className="font-medium">Días seleccionados:</span> {diasSolicitados}
            <span className="mx-2">|</span>
            <span className="font-medium">Disponibles:</span> {diasDisponiblesParaEdicion}
            <span className="mx-2">|</span>
            <span className={diasRestarian < 0 ? "text-red-600 font-medium" : ""}>
              Restarían: {diasRestarian}
            </span>
          </div>
          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button
            onClick={handleGuardar}
            disabled={!canGuardar || saving}
            className="bg-[#4CAF50] hover:bg-[#388E3C]"
          >
            {saving ? "Guardando..." : "Guardar cambios"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
