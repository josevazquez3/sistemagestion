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
import { Loader2, Download } from "lucide-react";

function formatFechaArgentina() {
  const now = new Date();
  const day = String(now.getDate()).padStart(2, "0");
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const year = now.getFullYear();
  const h = String(now.getHours()).padStart(2, "0");
  const m = String(now.getMinutes()).padStart(2, "0");
  return `${day}/${month}/${year} ${h}:${m}`;
}

function nombreArchivoBackup() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const h = String(now.getHours()).padStart(2, "0");
  const min = String(now.getMinutes()).padStart(2, "0");
  const s = String(now.getSeconds()).padStart(2, "0");
  return `backup_${y}${m}${d}_${h}${min}${s}.zip`;
}

export interface ModalBackupProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ModalBackup(props: ModalBackupProps) {
  const { open, onOpenChange } = props;
  const [generando, setGenerando] = useState(false);
  const [exito, setExito] = useState(false);

  const handleGenerar = async () => {
    setGenerando(true);
    setExito(false);
    try {
      const res = await fetch("/api/configuraciones/backup", { method: "POST" });
      if (!res.ok) throw new Error("Error al generar backup");
      const blob = await res.blob();
      const filename = res.headers.get("Content-Disposition")?.match(/filename="?([^";]+)"?/)?.[1] ?? nombreArchivoBackup();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      setExito(true);
    } catch {
      setExito(false);
    } finally {
      setGenerando(false);
    }
  };

  const handleClose = (openVal: boolean) => {
    if (!openVal) setExito(false);
    onOpenChange(openVal);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md" showCloseButton={!generando}>
        <DialogHeader>
          <DialogTitle>Generar Backup</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm text-gray-600">
          <p>
            <span className="font-medium text-gray-800">Fecha y hora:</span> {formatFechaArgentina()}
          </p>
          <p>
            <span className="font-medium text-gray-800">Archivo:</span> {nombreArchivoBackup()}
          </p>
          {exito && (
            <p className="text-green-600 font-medium">Backup generado correctamente.</p>
          )}
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => handleClose(false)}
            disabled={generando}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={handleGenerar}
            disabled={generando}
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            {generando ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Generando...
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                Generar y Descargar
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
