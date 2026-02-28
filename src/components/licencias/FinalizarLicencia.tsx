"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { SubirCertificados, type ArchivoPreview } from "./SubirCertificados";
import { Loader2 } from "lucide-react";

export interface FinalizarLicenciaProps {
  licenciaId: number;
  legajoNombre: string;
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function FinalizarLicencia({
  licenciaId,
  legajoNombre,
  open,
  onClose,
  onSuccess,
}: FinalizarLicenciaProps) {
  const [fechaCierre, setFechaCierre] = useState(() => {
    const d = new Date();
    return d.toISOString().slice(0, 10);
  });
  const [observacionesCierre, setObservacionesCierre] = useState("");
  const [archivos, setArchivos] = useState<ArchivoPreview[]>([]);
  const [guardando, setGuardando] = useState(false);
  const [subiendoCert, setSubiendoCert] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const guardar = async () => {
    setError(null);
    setGuardando(true);
    let todoOk = true;
    try {
      const res = await fetch(`/api/licencias/${licenciaId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          estado: "FINALIZADA",
          fechaCierre,
          observacionesCierre: observacionesCierre || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al finalizar");

      const sinError = archivos.filter((a) => !a.error);
      if (sinError.length > 0) {
        setSubiendoCert(true);
        const formData = new FormData();
        formData.set("etapa", "CIERRE");
        sinError.forEach((a) => formData.append("files", a.file));
        const up = await fetch(`/api/licencias/${licenciaId}/certificados`, {
          method: "POST",
          body: formData,
        });
        setSubiendoCert(false);
        if (!up.ok) {
          const err = await up.json();
          setError("Licencia finalizada pero falló subir certificados: " + (err.error || ""));
          todoOk = false;
        }
      }

      if (todoOk) {
        onSuccess?.();
        onClose();
      }
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
          <DialogTitle>Finalizar licencia</DialogTitle>
          <p className="text-sm text-gray-500">Empleado: {legajoNombre}</p>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="fechaCierre">Fecha efectiva de finalización</Label>
            <Input
              id="fechaCierre"
              type="date"
              value={fechaCierre}
              onChange={(e) => setFechaCierre(e.target.value)}
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="observacionesCierre">Observaciones de cierre</Label>
            <textarea
              id="observacionesCierre"
              value={observacionesCierre}
              onChange={(e) => setObservacionesCierre(e.target.value)}
              rows={2}
              className="mt-1 w-full rounded-md border border-input px-3 py-2 text-sm"
              placeholder="Notas del cierre..."
            />
          </div>
          <div>
            <Label>Certificados de cierre (PDF o JPG)</Label>
            <SubirCertificados value={archivos} onChange={setArchivos} />
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">{error}</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={guardando}>
            Cancelar
          </Button>
          <Button onClick={guardar} disabled={guardando || subiendoCert}>
            {guardando || subiendoCert ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Finalizar licencia
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
