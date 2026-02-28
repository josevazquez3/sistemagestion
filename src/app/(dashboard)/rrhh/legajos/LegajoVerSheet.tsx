"use client";

import { useState, useEffect } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { User, FileSpreadsheet, FileText } from "lucide-react";

const PARENTESCO_LABEL: Record<string, string> = {
  CONYUGE: "Cónyuge", HIJO: "Hijo/a", PADRE: "Padre", MADRE: "Madre", HERMANO: "Hermano/a", OTRO: "Otro",
};

type LegajoData = {
  id: string;
  numeroLegajo: number;
  nombres: string;
  apellidos: string;
  dni: string;
  cuil: string | null;
  fotoUrl: string | null;
  calle: string;
  numero: number;
  casa: string | null;
  departamento: string | null;
  piso: string | null;
  localidad: string;
  codigoPostal: string;
  fechaAlta: string;
  fechaBaja: string | null;
  motivoBaja: string | null;
  celular: string | null;
  contactos: {
    nombres: string;
    apellidos: string;
    parentesco: string;
    calle: string | null;
    numero: string | null;
    casa: string | null;
    departamento: string | null;
    piso: string | null;
    telefonos: { numero: string }[];
  }[];
};

export function LegajoVerSheet({ legajoId, onClose }: { legajoId: string | null; onClose: () => void }) {
  const [legajo, setLegajo] = useState<LegajoData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!legajoId) {
      setLegajo(null);
      return;
    }
    setLoading(true);
    fetch(`/api/legajos/${legajoId}`)
      .then((r) => r.json())
      .then(setLegajo)
      .catch(() => setLegajo(null))
      .finally(() => setLoading(false));
  }, [legajoId]);

  const formatFecha = (s: string | null) => (s ? new Date(s).toLocaleDateString("es-AR") : "-");

  return (
    <Sheet open={!!legajoId} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Ver legajo</SheetTitle>
          <SheetDescription>{legajo ? `Nº ${legajo.numeroLegajo} - ${legajo.apellidos}, ${legajo.nombres}` : ""}</SheetDescription>
        </SheetHeader>
        {loading ? (
          <div className="py-12 flex justify-center">Cargando...</div>
        ) : legajo ? (
          <div className="space-y-6 py-6">
            <div className="flex items-center gap-4">
              <div className="h-20 w-20 rounded-full bg-[#C8E6C9] flex items-center justify-center overflow-hidden">
                {legajo.fotoUrl ? (
                  <img src={legajo.fotoUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <User className="h-10 w-10 text-[#388E3C]" />
                )}
              </div>
              <div>
                <p className="font-semibold text-lg">{legajo.apellidos}, {legajo.nombres}</p>
                <p className="text-gray-500">Nº Legajo {legajo.numeroLegajo}</p>
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="font-medium text-gray-700">Datos personales</h3>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <span className="text-gray-500">DNI:</span><span>{legajo.dni}</span>
                <span className="text-gray-500">CUIL:</span><span>{legajo.cuil ?? "-"}</span>
                <span className="text-gray-500">Celular:</span><span>{legajo.celular ?? "-"}</span>
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="font-medium text-gray-700">Dirección</h3>
              <p className="text-sm">{legajo.calle} {legajo.numero}{legajo.casa ? ` ${legajo.casa}` : ""}</p>
              {(legajo.departamento || legajo.piso) && <p className="text-sm">Dpto: {legajo.departamento ?? "-"} | Piso: {legajo.piso ?? "-"}</p>}
              <p className="text-sm">{legajo.localidad} (CP {legajo.codigoPostal})</p>
            </div>

            <div className="space-y-2">
              <h3 className="font-medium text-gray-700">Fechas</h3>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <span className="text-gray-500">Fecha Alta:</span><span>{formatFecha(legajo.fechaAlta)}</span>
                <span className="text-gray-500">Fecha Baja:</span><span>{formatFecha(legajo.fechaBaja)}</span>
                {legajo.motivoBaja && (
                  <>
                    <span className="text-gray-500">Motivo:</span><span>{legajo.motivoBaja}</span>
                  </>
                )}
              </div>
            </div>

            {legajo.contactos.length > 0 && (
              <div className="space-y-2">
                <h3 className="font-medium text-gray-700">Contactos adicionales</h3>
                {legajo.contactos.map((c, i) => (
                  <div key={i} className="border rounded p-3 text-sm">
                    <p className="font-medium">{c.nombres} {c.apellidos} - {PARENTESCO_LABEL[c.parentesco] ?? c.parentesco}</p>
                    {(c.calle || c.numero) && <p>{c.calle ?? ""} {c.numero ?? ""}</p>}
                    {c.telefonos.length > 0 && <p>Tel: {c.telefonos.map((t) => t.numero).join(", ")}</p>}
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-2 pt-4">
              <a href={`/api/legajos/${legajo.id}/export-excel`} download className="flex-1">
                <Button className="w-full bg-[#4CAF50] hover:bg-[#388E3C] text-white">
                  <FileSpreadsheet className="h-4 w-4 mr-2" />
                  Exportar Excel
                </Button>
              </a>
              <a href={`/api/legajos/${legajo.id}/export-pdf`} download className="flex-1">
                <Button className="w-full bg-[#4CAF50] hover:bg-[#388E3C] text-white">
                  <FileText className="h-4 w-4 mr-2" />
                  Exportar PDF
                </Button>
              </a>
            </div>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
