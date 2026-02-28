"use client";

import { useState, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Upload } from "lucide-react";

export interface ModalRestoreProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ModalRestore({ open, onOpenChange }: ModalRestoreProps) {
  const [restaurando, setRestaurando] = useState(false);
  const [exito, setExito] = useState(false);
  const [archivoNombre, setArchivoNombre] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setArchivoNombre(file?.name ?? null);
  };

  const handleRestaurar = async () => {
    const file = inputRef.current?.files?.[0];
    if (!file) return;
    setRestaurando(true);
    setExito(false);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/configuraciones/restore", {
        method: "POST",
        body: form,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Error al restaurar");
      setExito(true);
    } catch (err) {
      setExito(false);
      alert(err instanceof Error ? err.message : "Error al restaurar el backup.");
    } finally {
      setRestaurando(false);
    }
  };

  const handleClose = (open: boolean) => {
    if (!open) {
      setExito(false);
      setArchivoNombre(null);
      if (inputRef.current) inputRef.current.value = "";
    }
    onOpenChange(open);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md" showCloseButton={!restaurando}>
        <DialogHeader>
          <DialogTitle>Restaurar Backup</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            ⚠️ Esta acción reemplazará los datos actuales con los del backup.
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Archivo .zip
            </label>
            <input
              ref={inputRef}
              type="file"
              accept=".zip"
              onChange={handleFileChange}
              className="block w-full text-sm text-gray-500 file:mr-2 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200"
            />
            {archivoNombre && (
              <p className="mt-1 text-xs text-gray-500">{archivoNombre}</p>
            )}
          </div>
          {exito && (
            <div className="flex flex-col gap-2">
              <p className="text-green-600 text-sm font-medium">
                Backup restaurado correctamente.
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => window.location.reload()}
              >
                Recargar la página
              </Button>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => handleClose(false)}
            disabled={restaurando}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={handleRestaurar}
            disabled={restaurando || !archivoNombre}
            className="bg-orange-500 hover:bg-orange-600 text-white"
          >
            {restaurando ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Restaurando datos...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                Restaurar
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
