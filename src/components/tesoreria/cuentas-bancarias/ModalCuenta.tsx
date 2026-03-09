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

export type CuentaBancaria = {
  id: number;
  codigo: string;
  codOperativo: string | null;
  nombre: string;
  activo: boolean;
  creadoEn: string;
  actualizadoEn: string;
};

type ModalCuentaProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cuenta: CuentaBancaria | null;
  onSuccess: () => void;
  showMessage: (tipo: "ok" | "error", text: string) => void;
};

export function ModalCuenta({
  open,
  onOpenChange,
  cuenta,
  onSuccess,
  showMessage,
}: ModalCuentaProps) {
  const [codigo, setCodigo] = useState("");
  const [codOperativo, setCodOperativo] = useState("");
  const [nombre, setNombre] = useState("");
  const [saving, setSaving] = useState(false);

  const esEdicion = !!cuenta;

  useEffect(() => {
    if (open) {
      setCodigo(cuenta?.codigo ?? "");
      setCodOperativo(cuenta?.codOperativo ?? "");
      setNombre(cuenta?.nombre ?? "");
    }
  }, [open, cuenta]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const c = (codigo ?? "").trim();
    const n = (nombre ?? "").trim();
    if (!c || !n) {
      showMessage("error", "Código y nombre son obligatorios.");
      return;
    }
    setSaving(true);
    try {
      const url = esEdicion
        ? `/api/tesoreria/cuentas-bancarias/${cuenta.id}`
        : "/api/tesoreria/cuentas-bancarias";
      const method = esEdicion ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          codigo: c,
          codOperativo: (codOperativo ?? "").trim() || null,
          nombre: n,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        showMessage("ok", esEdicion ? "Cuenta actualizada." : "Cuenta creada.");
        onOpenChange(false);
        onSuccess();
      } else {
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
          <DialogTitle>{esEdicion ? "Editar cuenta" : "Nueva cuenta"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="codigo">Código *</Label>
            <Input
              id="codigo"
              value={codigo}
              onChange={(e) => setCodigo(e.target.value)}
              placeholder="Ej. 1001"
              disabled={esEdicion}
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="codOperativo">Cód. operativo</Label>
            <Input
              id="codOperativo"
              type="text"
              value={codOperativo}
              onChange={(e) => setCodOperativo(e.target.value)}
              placeholder="Ej: 4674"
              className="mt-1"
            />
            <p className="text-xs text-gray-400 mt-0.5">Opcional</p>
          </div>
          <div>
            <Label htmlFor="nombre">Nombre de la cuenta *</Label>
            <Input
              id="nombre"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej. Gastos Bancarios"
              className="mt-1"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Guardando…" : "Guardar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
