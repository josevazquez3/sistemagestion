"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertTriangle, Trash2, Loader2 } from "lucide-react";

const CONFIRMAR_TEXTO = "CONFIRMAR";

export interface ModalVaciarBDDProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ModalVaciarBDD({ open, onOpenChange }: ModalVaciarBDDProps) {
  const [confirmacion, setConfirmacion] = useState("");
  const [eliminando, setEliminando] = useState(false);

  const puedeEliminar = confirmacion === CONFIRMAR_TEXTO && !eliminando;

  const handleEliminar = async () => {
    if (!puedeEliminar) return;
    setEliminando(true);
    try {
      const res = await fetch("/api/configuraciones/vaciar", { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Error al vaciar");
      onOpenChange(false);
      setConfirmacion("");
      window.location.reload();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error al vaciar la base de datos.");
    } finally {
      setEliminando(false);
    }
  };

  const handleClose = (open: boolean) => {
    if (!open) {
      setConfirmacion("");
    }
    onOpenChange(open);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md" showCloseButton={!eliminando}>
        <DialogHeader>
          <div className="flex items-center gap-2 text-red-600">
            <AlertTriangle className="h-8 w-8 shrink-0" />
            <DialogTitle className="text-red-700">⚠️ Acción irreversible</DialogTitle>
          </div>
        </DialogHeader>
        <p className="text-sm text-gray-600">
          Está a punto de eliminar TODA la base de datos. Esta acción no se puede
          deshacer. ¿Está seguro?
        </p>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Escribí <strong>{CONFIRMAR_TEXTO}</strong> para habilitar el botón:
          </label>
          <Input
            type="text"
            value={confirmacion}
            onChange={(e) => setConfirmacion(e.target.value)}
            placeholder={CONFIRMAR_TEXTO}
            className="font-mono"
            disabled={eliminando}
          />
        </div>
        <DialogFooter>
          <Button
            type="button"
            onClick={() => handleClose(false)}
            disabled={eliminando}
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={handleEliminar}
            disabled={!puedeEliminar}
            className="bg-red-600 hover:bg-red-700 text-white"
          >
            {eliminando ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <Trash2 className="h-4 w-4 mr-2" />
                Eliminar todo
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
