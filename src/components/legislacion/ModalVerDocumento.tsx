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
import type { DocumentoLegislacion } from "./types";

const TZ = "America/Argentina/Buenos_Aires";

function formatFecha(iso: string | null): string {
  if (!iso) return "—";
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

type ModalVerDocumentoProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documento: DocumentoLegislacion | null;
};

export function ModalVerDocumento({
  open,
  onOpenChange,
  documento,
}: ModalVerDocumentoProps) {
  if (!documento) return null;

  const handleDownload = () => {
    window.open(`/api/legislacion/${documento.id}/download`, "_blank");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Ver documento</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div>
            <span className="text-sm font-medium text-gray-500">Título</span>
            <p className="text-gray-900 mt-0.5">{documento.titulo}</p>
          </div>
          {documento.descripcion && (
            <div>
              <span className="text-sm font-medium text-gray-500">Descripción</span>
              <p className="text-gray-900 mt-0.5 whitespace-pre-wrap">{documento.descripcion}</p>
            </div>
          )}
          <div>
            <span className="text-sm font-medium text-gray-500">Categoría</span>
            <p className="text-gray-900 mt-0.5">{documento.categoria?.nombre ?? "—"}</p>
          </div>
          <div>
            <span className="text-sm font-medium text-gray-500">Tipo de archivo</span>
            <p className="text-gray-900 mt-0.5">{documento.tipoArchivo}</p>
          </div>
          <div>
            <span className="text-sm font-medium text-gray-500">Fecha del documento</span>
            <p className="text-gray-900 mt-0.5">{formatFecha(documento.fechaDocumento)}</p>
          </div>
          <div>
            <span className="text-sm font-medium text-gray-500">Fecha de carga</span>
            <p className="text-gray-900 mt-0.5">{formatFechaHora(documento.creadoEn)}</p>
          </div>
          <div className="pt-2">
            <Button
              size="sm"
              variant="outline"
              onClick={handleDownload}
              className="border-[#4CAF50] text-[#388E3C] hover:bg-[#E8F5E9]"
            >
              <Download className="h-4 w-4 mr-1" />
              Descargar archivo
            </Button>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cerrar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
