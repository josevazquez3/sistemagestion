"use client";

import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

export type TipoAsignacion =
  | "AL_ORDEN_DEL_DIA"
  | "AL_INFORME_GUIA"
  | "GIRAR_A_DISTRITOS"
  | "ARCHIVAR"
  | "OTROS";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  temaTexto: string;
  initialAsignaciones: Array<{ tipo: TipoAsignacion; otroTexto: string | null }>;
  onGuardar: (asignaciones: Array<{ tipo: TipoAsignacion; otroTexto?: string }>) => Promise<void>;
};

const OPCIONES: Array<{ tipo: TipoAsignacion; label: string }> = [
  { tipo: "AL_ORDEN_DEL_DIA", label: "Al Orden del Día" },
  { tipo: "AL_INFORME_GUIA", label: "Al Informe Guía" },
  { tipo: "GIRAR_A_DISTRITOS", label: "Girar a Distritos" },
  { tipo: "ARCHIVAR", label: "Archivar" },
  { tipo: "OTROS", label: "Otros" },
];

export function ModalAsignacion({ open, onOpenChange, temaTexto, initialAsignaciones, onGuardar }: Props) {
  const initialSet = useMemo(() => new Set(initialAsignaciones.map((a) => a.tipo)), [initialAsignaciones]);
  const initialOtros = useMemo(
    () => initialAsignaciones.find((a) => a.tipo === "OTROS")?.otroTexto ?? "",
    [initialAsignaciones]
  );

  const [seleccion, setSeleccion] = useState<Set<TipoAsignacion>>(new Set());
  const [otros, setOtros] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSeleccion(new Set(initialSet));
    setOtros(initialOtros || "");
  }, [open, initialSet, initialOtros]);

  const toggle = (tipo: TipoAsignacion, on: boolean) => {
    setSeleccion((prev) => {
      const n = new Set(prev);
      if (on) n.add(tipo);
      else n.delete(tipo);
      return n;
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[88vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Asignar Tema</DialogTitle>
          <p className="text-sm text-muted-foreground font-normal text-left line-clamp-3">
            {temaTexto}
          </p>
        </DialogHeader>

        <div className="flex-1 overflow-auto space-y-2 pr-1">
          {OPCIONES.map((o) => (
            <div key={o.tipo} className="flex items-center gap-3 rounded-md border px-3 py-2">
              <Checkbox
                checked={seleccion.has(o.tipo)}
                onCheckedChange={(v) => toggle(o.tipo, v === true)}
              />
              <span className="text-sm">{o.label}</span>
            </div>
          ))}

          {seleccion.has("OTROS") && (
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Texto (Otros)</label>
              <input
                value={otros}
                onChange={(e) => setOtros(e.target.value)}
                className="w-full h-9 rounded-md border border-gray-300 px-3 text-sm"
                placeholder="Ingresá el texto…"
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" disabled={saving} onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            type="button"
            disabled={saving}
            className="bg-[#4CAF50] hover:bg-[#388E3C]"
            onClick={async () => {
              const list = [...seleccion].map((t) =>
                t === "OTROS" ? { tipo: t, otroTexto: otros.trim() } : { tipo: t }
              );
              if (seleccion.has("OTROS") && !otros.trim()) return;
              setSaving(true);
              try {
                await onGuardar(list as Array<{ tipo: TipoAsignacion; otroTexto?: string }>);
                onOpenChange(false);
              } finally {
                setSaving(false);
              }
            }}
          >
            Guardar Asignación
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

