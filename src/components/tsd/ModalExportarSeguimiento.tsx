"use client";

import { useState } from "react";
import * as XLSX from "xlsx";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getMovimientosByNroExpte } from "@/lib/actions/tsd.actions";
import {
  formatTsdFecha,
  hoyParaNombreArchivo,
  sanitizarNombreArchivo,
  tsdEstadoLabel,
} from "@/lib/tsd/display";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onError: (msg: string) => void;
};

export function ModalExportarSeguimiento({ open, onOpenChange, onError }: Props) {
  const [nro, setNro] = useState("");
  const [loading, setLoading] = useState(false);

  const exportar = async () => {
    const trimmed = nro.trim();
    if (!trimmed) {
      onError("Ingresá el Nº de expediente.");
      return;
    }
    setLoading(true);
    try {
      const movs = await getMovimientosByNroExpte(trimmed);
      if (movs.length === 0) {
        onError("No hay movimientos para ese Nº de expediente.");
        return;
      }
      const rows: (string | number)[][] = [
        ["Fecha", "Nº Expte.", "Carátula", "Distrito", "Estado", "Observación"],
      ];
      for (const m of movs) {
        const ex = m.expediente;
        rows.push([
          formatTsdFecha(new Date(m.fecha)),
          ex.nroExpte,
          ex.caratula,
          ex.distrito,
          tsdEstadoLabel(m.estado),
          m.observacion ?? "",
        ]);
      }
      const ws = XLSX.utils.aoa_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Seguimiento");
      const safeNro = sanitizarNombreArchivo(trimmed);
      const fname = `Seguimiento_Expte_${safeNro}_${hoyParaNombreArchivo()}.xlsx`;
      XLSX.writeFile(wb, fname);
      onOpenChange(false);
      setNro("");
    } catch (e) {
      onError(e instanceof Error ? e.message : "Error al exportar.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Exportar seguimiento</DialogTitle>
        </DialogHeader>
        <div className="grid gap-2 py-2">
          <Label htmlFor="exp-nro">Nº Expte.</Label>
          <Input id="exp-nro" value={nro} onChange={(e) => setNro(e.target.value)} placeholder="Ej. 12345/2024" />
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button type="button" onClick={() => void exportar()} disabled={loading}>
            {loading ? "Generando…" : "Exportar informe"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
