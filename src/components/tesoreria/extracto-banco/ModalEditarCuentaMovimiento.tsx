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
import { SelectorCuenta } from "./SelectorCuenta";
import type { MovimientoExtracto } from "./TablaMovimientos";

type ModalEditarCuentaMovimientoProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  movimiento: MovimientoExtracto | null;
  onSuccess: () => void;
  showMessage: (tipo: "ok" | "error", text: string) => void;
};

export function ModalEditarCuentaMovimiento({
  open,
  onOpenChange,
  movimiento,
  onSuccess,
  showMessage,
}: ModalEditarCuentaMovimientoProps) {
  const [cuentaId, setCuentaId] = useState<number | null>(null);
  const [codigo, setCodigo] = useState("");
  const [nombre, setNombre] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && movimiento) {
      setCuentaId(movimiento.cuentaId);
      setCodigo(movimiento.cuenta?.codigo ?? "");
      setNombre(movimiento.cuenta?.nombre ?? "");
    }
  }, [open, movimiento]);

  const handleGuardar = async () => {
    if (!movimiento) return;
    setSaving(true);
    const res = await fetch(`/api/tesoreria/extracto-banco/${movimiento.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cuentaId }),
    });
    setSaving(false);
    if (res.ok) {
      showMessage("ok", "Cuenta asignada.");
      onOpenChange(false);
      onSuccess();
    } else {
      const data = await res.json();
      showMessage("error", data.error || "Error al guardar");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Editar cuenta del movimiento</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <SelectorCuenta
            cuentaId={cuentaId}
            codigoInicial={codigo}
            nombreInicial={nombre}
            onSelect={(id, c, n) => {
              setCuentaId(id);
              setCodigo(c);
              setNombre(n);
            }}
          />
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
