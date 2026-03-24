"use client";

import { useEffect, useState } from "react";
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
import type { MayorCuenta, MayorMovimiento } from "@/types/tesoreria";
import { formatearFechaUTC, parsearFechaSegura } from "@/lib/utils/fecha";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  movimiento: MayorMovimiento | null;
  cuentas: MayorCuenta[];
  showMessage: (tipo: "ok" | "error", text: string) => void;
  onGuardado: () => void;
};

function fechaInputDesdeIso(iso: string | null): string {
  if (!iso) return "";
  try {
    return formatearFechaUTC(new Date(iso));
  } catch {
    return "";
  }
}

export function ModalEditarMayorMovimiento({
  open,
  onOpenChange,
  movimiento,
  cuentas,
  showMessage,
  onGuardado,
}: Props) {
  const [fecha, setFecha] = useState("");
  const [concepto, setConcepto] = useState("");
  const [importe, setImporte] = useState("");
  const [cuentaId, setCuentaId] = useState("");
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (open && movimiento) {
      setFecha(fechaInputDesdeIso(movimiento.fecha));
      setConcepto(movimiento.concepto);
      setImporte(String(movimiento.importe));
      setCuentaId(String(movimiento.cuentaId));
    }
  }, [open, movimiento]);

  const guardar = async () => {
    if (!movimiento) return;
    const d = parsearFechaSegura(fecha.trim());
    if (!d) {
      showMessage("error", "Fecha inválida (DD/MM/YYYY).");
      return;
    }
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, "0");
    const day = String(d.getUTCDate()).padStart(2, "0");
    const fechaIso = `${y}-${m}-${day}T12:00:00.000Z`;
    const imp = parseFloat(importe.replace(",", "."));
    if (Number.isNaN(imp)) {
      showMessage("error", "Importe inválido.");
      return;
    }
    const cId = parseInt(cuentaId, 10);
    if (!cId) {
      showMessage("error", "Elegí una cuenta.");
      return;
    }
    const conceptoT = concepto.trim();
    if (!conceptoT) {
      showMessage("error", "Concepto obligatorio.");
      return;
    }
    setGuardando(true);
    try {
      const res = await fetch(`/api/tesoreria/mayor-movimientos/${movimiento.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fecha: fechaIso,
          concepto: conceptoT,
          importe: imp,
          cuentaId: cId,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showMessage("error", data?.error || "Error al guardar.");
        return;
      }
      showMessage("ok", "Movimiento actualizado.");
      onGuardado();
      onOpenChange(false);
    } catch {
      showMessage("error", "Error de conexión.");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Editar movimiento</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div>
            <Label>Fecha (DD/MM/YYYY)</Label>
            <Input value={fecha} onChange={(e) => setFecha(e.target.value)} placeholder="DD/MM/YYYY" />
          </div>
          <div>
            <Label>Concepto</Label>
            <Input value={concepto} onChange={(e) => setConcepto(e.target.value)} />
          </div>
          <div>
            <Label>Importe</Label>
            <Input value={importe} onChange={(e) => setImporte(e.target.value)} />
          </div>
          <div>
            <Label>Cuenta</Label>
            <select
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
              value={cuentaId}
              onChange={(e) => setCuentaId(e.target.value)}
            >
              {cuentas.map((c) => (
                <option key={c.id} value={String(c.id)}>
                  {c.nombre}
                </option>
              ))}
            </select>
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="button" disabled={guardando} onClick={() => void guardar()}>
            {guardando ? "Guardando…" : "Guardar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
