"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FileDown, Loader2 } from "lucide-react";

interface BotonesExportacionProps {
  legajoId?: string;
  anio?: number;
  estado?: string;
  nombreEmpleado: string;
}

const SPINNER_FALLBACK_MS = 2000;

export function BotonesExportacion({
  legajoId,
  anio,
  estado,
  nombreEmpleado,
}: BotonesExportacionProps) {
  const [descargando, setDescargando] = useState<"excel" | "pdf" | null>(null);

  const construirUrl = (formato: "excel" | "pdf") => {
    const params = new URLSearchParams();
    params.set("formato", formato);
    if (legajoId) params.set("legajoId", legajoId);
    if (anio !== undefined) params.set("anio", String(anio));
    if (estado) params.set("estado", estado);
    return `/api/vacaciones/historial/export?${params.toString()}`;
  };

  const handleExportar = (formato: "excel" | "pdf") => {
    if (descargando) return;
    setDescargando(formato);
    const url = construirUrl(formato);
    window.location.href = url;
    setTimeout(() => setDescargando(null), SPINNER_FALLBACK_MS);
  };

  return (
    <div className="flex gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={() => handleExportar("excel")}
        disabled={descargando !== null}
      >
        {descargando === "excel" ? (
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        ) : (
          <FileDown className="h-4 w-4 mr-2" />
        )}
        Exportar Excel
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={() => handleExportar("pdf")}
        disabled={descargando !== null}
      >
        {descargando === "pdf" ? (
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        ) : (
          <FileDown className="h-4 w-4 mr-2" />
        )}
        Exportar PDF
      </Button>
    </div>
  );
}
