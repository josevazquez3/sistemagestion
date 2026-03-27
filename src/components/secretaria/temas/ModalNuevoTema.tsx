"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { InputFecha } from "@/components/ui/InputFecha";
import { formatearFechaUTC } from "@/lib/utils/fecha";

export type TemaUsoInicial = {
  id: number;
  fechaOD: string | null;
  guiaMesa: string | null;
  createdAt: string;
};

export type InitialTemaModal = {
  fecha: string;
  tema: string;
  observacion: string | null;
  /** Si está definido, es edición: el modal llama PUT tema + PUT usos/reciente. */
  temaId?: number;
  usos?: TemaUsoInicial[];
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: InitialTemaModal | null;
  userName: string;
  /** Solo alta (POST). No se invoca cuando se edita con `initial.temaId`. */
  onGuardar: (data: { fecha: string; tema: string; observacion: string | null }) => Promise<void>;
  /** Tras guardar edición (PUT tema + PUT usos/reciente). */
  refetch?: () => Promise<void>;
  onEditarExito?: () => void;
  onError?: (message: string) => void;
};

export function ModalNuevoTema({
  open,
  onOpenChange,
  initial,
  userName,
  onGuardar,
  refetch,
  onEditarExito,
  onError,
}: Props) {
  const [fecha, setFecha] = useState("");
  const [tema, setTema] = useState("");
  const [observacion, setObservacion] = useState("");
  const [fechaOD, setFechaOD] = useState("");
  const [guiaMesa, setGuiaMesa] = useState("");
  const [saving, setSaving] = useState(false);

  const esEdicion = Boolean(initial?.temaId);

  useEffect(() => {
    if (!open) return;
    setFecha(initial?.fecha ?? "");
    setTema(initial?.tema ?? "");
    setObservacion(initial?.observacion ?? "");

    const usos = initial?.usos ?? [];
    const usoReciente = [...usos].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )[0];

    setFechaOD(
      usoReciente?.fechaOD ? formatearFechaUTC(new Date(usoReciente.fechaOD)) : ""
    );
    setGuiaMesa(
      usoReciente?.guiaMesa ? formatearFechaUTC(new Date(usoReciente.guiaMesa)) : ""
    );
  }, [open, initial]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[88vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>{esEdicion ? "Editar Tema" : "Nuevo Tema"}</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-auto space-y-4 pr-1">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Fecha *</label>
            <InputFecha
              value={fecha}
              onChange={setFecha}
              placeholder="DD/MM/YYYY"
              className="w-full h-9 rounded-md border border-gray-300 px-3 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tema *</label>
            <textarea
              value={tema}
              onChange={(e) => setTema(e.target.value)}
              rows={3}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Observación (opcional)</label>
            <textarea
              value={observacion}
              onChange={(e) => setObservacion(e.target.value)}
              rows={3}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </div>

          {esEdicion && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Fecha OD</label>
                <InputFecha
                  value={fechaOD}
                  onChange={setFechaOD}
                  placeholder="DD/MM/YYYY"
                  className="w-full h-9 rounded-md border border-gray-300 px-3 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Guía Mesa</label>
                <InputFecha
                  value={guiaMesa}
                  onChange={setGuiaMesa}
                  placeholder="DD/MM/YYYY"
                  className="w-full h-9 rounded-md border border-gray-300 px-3 text-sm"
                />
              </div>
            </>
          )}

          <div className="text-sm text-gray-600">
            <span className="font-medium">Usuario:</span> {userName || "—"}
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" disabled={saving} onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            type="button"
            className="bg-[#4CAF50] hover:bg-[#388E3C]"
            disabled={saving}
            onClick={async () => {
              const f = fecha.trim();
              const t = tema.trim();
              if (!f) return;
              if (!t) return;
              setSaving(true);
              try {
                const payload = {
                  fecha: f,
                  tema: t,
                  observacion: observacion.trim() || null,
                };

                if (esEdicion && initial?.temaId) {
                  try {
                    const res1 = await fetch(`/api/secretaria/temas/${initial.temaId}`, {
                      method: "PUT",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify(payload),
                    });
                    const j1 = await res1.json().catch(() => ({}));
                    if (!res1.ok) {
                      throw new Error(typeof j1?.error === "string" ? j1.error : "No se pudo actualizar el tema.");
                    }

                    const res2 = await fetch(`/api/secretaria/temas/${initial.temaId}/usos/reciente`, {
                      method: "PUT",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        fechaOD: fechaOD.trim() || null,
                        guiaMesa: guiaMesa.trim() || null,
                      }),
                    });
                    const j2 = await res2.json().catch(() => ({}));
                    if (!res2.ok) {
                      throw new Error(
                        typeof j2?.error === "string" ? j2.error : "No se pudo actualizar Fecha OD / Guía Mesa."
                      );
                    }

                    await refetch?.();
                    onEditarExito?.();
                    onOpenChange(false);
                  } catch (e) {
                    onError?.(e instanceof Error ? e.message : "Error al guardar.");
                  }
                  return;
                }

                await onGuardar(payload);
                onOpenChange(false);
              } finally {
                setSaving(false);
              }
            }}
          >
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
