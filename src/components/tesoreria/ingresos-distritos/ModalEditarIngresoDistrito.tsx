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
import { InputFecha } from "@/components/ui/InputFecha";
import { Label } from "@/components/ui/label";
import { formatearImporteAR, parsearImporteAR } from "@/lib/parsearExtracto";
import type { IngresoDistrito } from "@/types/ingresos-distritos";

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

type ModalEditarIngresoDistritoProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  registro: IngresoDistrito | null;
  mes: number;
  anio: number;
  codigos: string[];
  onSuccess: () => void;
  showMessage: (tipo: "ok" | "error", text: string) => void;
};

export function ModalEditarIngresoDistrito({
  open,
  onOpenChange,
  registro,
  mes,
  anio,
  codigos,
  onSuccess,
  showMessage,
}: ModalEditarIngresoDistritoProps) {
  const isCreate = registro == null;
  const [fecha, setFecha] = useState("");
  const [recibo, setRecibo] = useState("");
  const [distrito, setDistrito] = useState("");
  const [concepto, setConcepto] = useState("");
  const [periodo, setPeriodo] = useState("");
  const [ctaColeg, setCtaColeg] = useState("");
  const [nMatriculados, setNMatriculados] = useState("");
  const [importe, setImporte] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      if (registro) {
        setFecha(formatFechaInput(registro.fecha));
        setRecibo(registro.recibo ?? "");
        setDistrito(registro.distrito ?? "");
        setConcepto(registro.concepto);
        setPeriodo(registro.periodo ?? "");
        setCtaColeg(registro.ctaColeg != null ? formatearImporteAR(registro.ctaColeg) : "");
        setNMatriculados(registro.nMatriculados != null ? formatearImporteAR(registro.nMatriculados) : "");
        setImporte(formatearImporteAR(registro.importe));
      } else {
        setFecha("");
        setRecibo("");
        setDistrito("");
        setConcepto("");
        setPeriodo("");
        setCtaColeg("");
        setNMatriculados("");
        setImporte("");
      }
    }
  }, [open, registro]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
    const periodoT = periodo.trim();
    const importeVal = Math.abs(parsearImporteAR(importe));
    const ctaVal = ctaColeg.trim() ? parsearImporteAR(ctaColeg) : null;
    const nMatVal = nMatriculados.trim() ? parsearImporteAR(nMatriculados) : null;

    setSaving(true);
    try {
      if (isCreate) {
        const res = await fetch("/api/tesoreria/ingresos-distritos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mes,
            anio,
            codigos,
            fecha: fechaIso,
            recibo: recibo.trim() || null,
            distrito: distrito.trim() || null,
            concepto: conceptoT,
            periodo: periodoT || null,
            ctaColeg: ctaVal,
            nMatriculados: nMatVal,
            importe: importeVal,
          }),
        });
        if (!res.ok) {
          const data = await res.json();
          showMessage("error", data.error || "Error al crear.");
          return;
        }
        showMessage("ok", "Registro creado.");
      } else {
        const res = await fetch(`/api/tesoreria/ingresos-distritos/${registro.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fecha: fechaIso,
            recibo: recibo.trim() || null,
            distrito: distrito.trim() || null,
            concepto: conceptoT,
            periodo: periodoT || null,
            ctaColeg: ctaVal,
            nMatriculados: nMatVal,
            importe: importeVal,
          }),
        });
        if (!res.ok) {
          const data = await res.json();
          showMessage("error", data.error || "Error al guardar.");
          return;
        }
        showMessage("ok", "Registro actualizado.");
      }
      onSuccess();
      onOpenChange(false);
    } catch {
      showMessage("error", "Error de conexión.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isCreate ? "Nuevo registro" : "Editar registro"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Fecha (DD/MM/YYYY)</Label>
              <InputFecha
                value={fecha}
                onChange={setFecha}
                placeholder="DD/MM/YYYY"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
              />
            </div>
            <div>
              <Label>Recibo Nº</Label>
              <Input
                value={recibo}
                onChange={(e) => setRecibo(e.target.value)}
                placeholder="Opcional"
              />
            </div>
          </div>
          <div>
            <Label>Distrito</Label>
            <Input
              value={distrito}
              onChange={(e) => setDistrito(e.target.value)}
              placeholder="Opcional"
            />
          </div>
          <div>
            <Label>Concepto</Label>
            <Input
              value={concepto}
              onChange={(e) => setConcepto(e.target.value)}
              placeholder="Ej: CTA. COLEG. 08/2025"
              required
            />
          </div>
          <div>
            <Label>Periodo</Label>
            <Input
              value={periodo}
              onChange={(e) => setPeriodo(e.target.value)}
              placeholder="Ej: 03/2026 o texto libre"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Podés usar <span className="font-medium">MM/YYYY</span>, solo texto o ambos (ej. &quot;03/2026 — Nuevos matriculados&quot;).
            </p>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label>Cta. Coleg.</Label>
              <Input
                value={ctaColeg}
                onChange={(e) => setCtaColeg(e.target.value)}
                placeholder="0,00"
              />
            </div>
            <div>
              <Label>N. Matriculados</Label>
              <Input
                value={nMatriculados}
                onChange={(e) => setNMatriculados(e.target.value)}
                placeholder="0,00"
              />
            </div>
            <div>
              <Label>Importe *</Label>
              <Input
                value={importe}
                onChange={(e) => setImporte(e.target.value)}
                placeholder="0,00"
                required
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Guardando…" : isCreate ? "Crear" : "Guardar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
