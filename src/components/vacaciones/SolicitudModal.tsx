"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CheckCircle, Download } from "lucide-react";

interface SolicitudModalProps {
  open: boolean;
  onClose: () => void;
  diasSolicitados: number;
  diasRestantes: number;
  solicitudId: number;
}

export function SolicitudModal({
  open,
  onClose,
  diasSolicitados,
  diasRestantes,
  solicitudId,
}: SolicitudModalProps) {
  const handleDescargar = () => {
    window.open(
      `/api/vacaciones/documento/${solicitudId}`,
      "_blank",
      "noopener,noreferrer"
    );
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-green-700">
            <CheckCircle className="h-6 w-6" />
            Solicitud registrada correctamente
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-2 py-4">
          <p>
            <span className="font-medium">Días solicitados:</span> {diasSolicitados}
          </p>
          <p>
            <span className="font-medium">Días restantes:</span> {diasRestantes}
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cerrar
          </Button>
          <Button onClick={handleDescargar} className="bg-[#4CAF50] hover:bg-[#388E3C]">
            <Download className="h-4 w-4 mr-2" />
            Descargar documento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
