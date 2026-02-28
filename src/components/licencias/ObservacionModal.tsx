"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";

export interface ObservacionModalProps {
  licenciaId: number;
  empleadoNombre: string;
  tipoLicencia: string;
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

type Observacion = { id: number; texto: string };

export function ObservacionModal({
  licenciaId,
  empleadoNombre,
  tipoLicencia,
  open,
  onClose,
  onSuccess,
}: ObservacionModalProps) {
  const [texto, setTexto] = useState("");
  const [loading, setLoading] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [observacionId, setObservacionId] = useState<number | null>(null);

  useEffect(() => {
    if (!open || !licenciaId) return;
    setError(null);
    setLoading(true);
    setTexto("");
    setObservacionId(null);
    fetch(`/api/licencias/${licenciaId}/observaciones`)
      .then((r) => r.json())
      .then((data) => {
        const list: Observacion[] = data.data ?? [];
        const ultima = list[0];
        if (ultima) {
          setTexto(ultima.texto);
          setObservacionId(ultima.id);
        }
      })
      .catch(() => setError("Error al cargar observaciones"))
      .finally(() => setLoading(false));
  }, [open, licenciaId]);

  const guardar = async () => {
    setError(null);
    setGuardando(true);
    try {
      if (observacionId !== null) {
        const res = await fetch(`/api/licencias/${licenciaId}/observaciones/${observacionId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ texto: texto.trim() || "" }),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "Error al guardar");
        }
      } else {
        const res = await fetch(`/api/licencias/${licenciaId}/observaciones`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ texto: texto.trim() || "" }),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "Error al guardar");
        }
      }
      onSuccess?.();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al guardar");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Agregar / Editar observación</DialogTitle>
          <p className="text-sm text-gray-500">
            {empleadoNombre} — {tipoLicencia}
          </p>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="obs-texto">Observaciones (opcional)</Label>
            {loading ? (
              <p className="text-sm text-gray-500 mt-1">Cargando...</p>
            ) : (
              <textarea
                id="obs-texto"
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                rows={6}
                className="mt-1 w-full rounded-md border border-input px-3 py-2 text-sm"
                placeholder="Escribí las observaciones para la nómina..."
              />
            )}
          </div>
          {error && (
            <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">{error}</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={guardando}>
            Cancelar
          </Button>
          <Button onClick={guardar} disabled={loading || guardando}>
            {guardando ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
