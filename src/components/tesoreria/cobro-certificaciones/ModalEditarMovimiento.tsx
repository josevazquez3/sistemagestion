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
import { formatearImporteAR, parsearImporteAR } from "@/lib/parsearExtracto";

export type MovimientoCobroCertificacion = {
  id: string;
  fecha: string;
  concepto: string;
  importe: number;
  saldo: number;
  mes: number;
  anio: number;
  importado: boolean;
};

const TZ = "America/Argentina/Buenos_Aires";

function formatFechaInput(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("es-AR", {
      timeZone: TZ,
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return iso.slice(0, 10);
  }
}

type ModalEditarMovimientoProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  movimiento: MovimientoCobroCertificacion | null;
  onSuccess: () => void;
  showMessage: (tipo: "ok" | "error", text: string) => void;
};

export function ModalEditarMovimiento({
  open,
  onOpenChange,
  movimiento,
  onSuccess,
  showMessage,
}: ModalEditarMovimientoProps) {
  const [fecha, setFecha] = useState("");
  const [concepto, setConcepto] = useState("");
  const [importe, setImporte] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && movimiento) {
      setFecha(formatFechaInput(movimiento.fecha));
      setConcepto(movimiento.concepto);
      setImporte(
        movimiento.importe < 0
          ? formatearImporteAR(movimiento.importe)
          : String(movimiento.importe)
      );
    }
  }, [open, movimiento]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!movimiento) return;
    const [d, m, y] = fecha.trim().split("/");
    if (!d || !m || !y) {
      showMessage("error", "Fecha inválida (DD/MM/YYYY).");
      return;
    }
    const fechaIso = `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}T12:00:00.000-03:00`;
    const conceptoT = concepto.trim();
    if (!conceptoT) {
      showMessage("error", "El concepto es obligatorio.");
      return;
    }
    const valor = Math.abs(parsearImporteAR(importe));

    setSaving(true);
    try {
      const res = await fetch(`/api/tesoreria/cobro-certificaciones/${movimiento.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fecha: fechaIso,
          concepto: conceptoT,
          importePesos: valor,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        showMessage("ok", "Movimiento actualizado.");
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

  if (!movimiento) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Editar movimiento</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="edit-fecha">Fecha *</Label>
            <Input
              id="edit-fecha"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              placeholder="DD/MM/YYYY"
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="edit-concepto">Concepto *</Label>
            <Input
              id="edit-concepto"
              value={concepto}
              onChange={(e) => setConcepto(e.target.value)}
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="edit-importe">Importe *</Label>
            <Input
              id="edit-importe"
              value={importe}
              onChange={(e) => setImporte(e.target.value)}
              placeholder="Ej: 1.500,00"
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
