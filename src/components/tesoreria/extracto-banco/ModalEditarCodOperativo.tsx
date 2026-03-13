"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { MovimientoExtracto } from "./TablaMovimientos";

type ModalEditarCodOperativoProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  movimiento: MovimientoExtracto | null;
  onSuccess: () => void;
  showMessage: (tipo: "ok" | "error", text: string) => void;
};

export function ModalEditarCodOperativo({
  open,
  onOpenChange,
  movimiento,
  onSuccess,
  showMessage,
}: ModalEditarCodOperativoProps) {
  const [valor, setValor] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && movimiento) {
      setValor(movimiento.codOperativo ?? "");
    }
  }, [open, movimiento]);

  const handleGuardar = async () => {
    if (!movimiento) return;
    const trimmed = valor.trim();
    if (!trimmed) {
      showMessage("error", "El Código Operativo no puede quedar vacío.");
      return;
    }
    if (trimmed === (movimiento.codOperativo ?? "")) {
      showMessage("error", "No hubo cambios en el valor.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/tesoreria/extracto-banco/${movimiento.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ codOperativo: trimmed }),
      });
      if (res.ok) {
        showMessage("ok", "Código operativo actualizado.");
        onOpenChange(false);
        onSuccess();
      } else {
        const data = await res.json();
        showMessage("error", data.error || "Error al guardar");
      }
    } catch {
      showMessage("error", "Error de conexión");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Editar Código Operativo</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="codOp">Cód. Op.</Label>
            <Input
              id="codOp"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              placeholder="Ej: 4085"
              maxLength={50}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleGuardar} disabled={saving}>
            {saving ? "Guardando…" : "Guardar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
