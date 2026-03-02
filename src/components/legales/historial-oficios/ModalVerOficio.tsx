"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Download } from "lucide-react";
import type { OficioRespondido } from "./types";

const TZ = "America/Argentina/Buenos_Aires";

function formatFecha(iso: string): string {
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

function formatFechaHora(iso: string): string {
  try {
    return new Date(iso).toLocaleString("es-AR", {
      timeZone: TZ,
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso.slice(0, 16);
  }
}

type ModalVerOficioProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  oficio: OficioRespondido | null;
};

export function ModalVerOficio({
  open,
  onOpenChange,
  oficio,
}: ModalVerOficioProps) {
  if (!oficio) return null;

  const handleDownload = () => {
    window.open(`/api/legales/historial-oficios/${oficio.id}/download`, "_blank");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Ver oficio</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div>
            <span className="text-sm font-medium text-gray-500">Título del oficio</span>
            <p className="text-gray-900 mt-0.5">{oficio.titulo}</p>
          </div>
          <div>
            <span className="text-sm font-medium text-gray-500">Fecha del oficio</span>
            <p className="text-gray-900 mt-0.5">{formatFecha(oficio.fechaOficio)}</p>
          </div>
          <div>
            <span className="text-sm font-medium text-gray-500">Fecha de carga</span>
            <p className="text-gray-900 mt-0.5">{formatFechaHora(oficio.creadoEn)}</p>
          </div>
          {oficio.urlArchivo && oficio.nombreArchivo && (
            <div className="pt-2">
              <Button
                size="sm"
                variant="outline"
                onClick={handleDownload}
                className="border-[#4CAF50] text-[#388E3C] hover:bg-[#E8F5E9]"
              >
                <Download className="h-4 w-4 mr-1" />
                Descargar .docx
              </Button>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
