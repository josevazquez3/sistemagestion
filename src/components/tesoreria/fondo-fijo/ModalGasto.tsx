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
import { parsearImporteAR } from "@/lib/parsearExtracto";

type ModalGastoProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mes: number;
  anio: number;
  onSuccess: () => void;
  showMessage: (tipo: "ok" | "error", text: string) => void;
};

function parsearFechaDD_MM_YYYY(str: string): string {
  const [d, m, y] = str.trim().split("/");
  if (!d || !m || !y) return "";
  const yy = y!.length === 2 ? `20${y}` : y!;
  return `${yy}-${m!.padStart(2, "0")}-${d!.padStart(2, "0")}T12:00:00.000-03:00`;
}

export function ModalGasto({
  open,
  onOpenChange,
  mes,
  anio,
  onSuccess,
  showMessage,
}: ModalGastoProps) {
  const [fecha, setFecha] = useState("");
  const [importe, setImporte] = useState("");
  const [concepto, setConcepto] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      const hoy = new Date();
      setFecha(
        hoy.toLocaleDateString("es-AR", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        }).replace(/\//g, "/")
      );
      setImporte("");
      setConcepto("");
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const fechaIso = parsearFechaDD_MM_YYYY(fecha);
    if (!fechaIso) {
      showMessage("error", "Fecha inválida (usá DD/MM/YYYY).");
      return;
    }
    const valor = parsearImporteAR(importe);
    if (!valor || valor <= 0) {
      showMessage("error", "Ingresá un importe válido.");
      return;
    }
    const conceptoT = concepto.trim();
    if (!conceptoT) {
      showMessage("error", "El concepto es obligatorio.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/tesoreria/fondo-fijo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fecha: fechaIso,
          concepto: conceptoT,
          importePesos: -Math.abs(valor),
          mes,
          anio,
          tipo: "GASTO",
        }),
      });
      const data = await res.json();
      if (res.ok) {
        showMessage("ok", "Gasto registrado.");
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
          <DialogTitle>Registrar gasto</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="gasto-fecha">Fecha *</Label>
            <Input
              id="gasto-fecha"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              placeholder="DD/MM/YYYY"
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="gasto-importe">Importe *</Label>
            <Input
              id="gasto-importe"
              value={importe}
              onChange={(e) => setImporte(e.target.value)}
              placeholder="Ej: 1.500,00"
              className="mt-1"
            />
            <p className="text-xs text-red-600 mt-0.5">
              Se registrará como gasto (negativo).
            </p>
          </div>
          <div>
            <Label htmlFor="gasto-concepto">Concepto *</Label>
            <Input
              id="gasto-concepto"
              value={concepto}
              onChange={(e) => setConcepto(e.target.value)}
              placeholder="Ej: Verdulería Mesa Directiva"
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
