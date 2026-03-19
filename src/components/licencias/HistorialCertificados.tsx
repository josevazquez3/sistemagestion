 "use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { TIPO_LICENCIA_LABEL } from "@/lib/licencias.utils";
import { formatearFechaLicencia } from "@/lib/licencias.utils";
import { Download, Trash2 } from "lucide-react";
import type { TipoLicencia } from "@prisma/client";

type CertificadoRow = {
  id: number;
  nombreArchivo: string;
  tipoArchivo: string;
  urlArchivo: string;
  fechaCarga: string;
  etapa: string;
  legajo: { id: string; numeroLegajo: number; nombres: string; apellidos: string };
  licencia: { id: number; tipoLicencia: TipoLicencia; fechaInicio: string; estado: string };
};

export function HistorialCertificados() {
  const [certificados, setCertificados] = useState<CertificadoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroTipo, setFiltroTipo] = useState("");
  const { data: session } = useSession();
  const roles = (session?.user as { roles?: string[] })?.roles ?? [];
  const puedeEliminar = roles.includes("SUPER_ADMIN") || roles.includes("ADMIN");

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filtroTipo) params.set("tipoLicencia", filtroTipo);
      const res = await fetch(`/api/certificados/historial?${params}`);
      const data = await res.json();
      setCertificados(data.data || []);
    } catch {
      setCertificados([]);
    } finally {
      setLoading(false);
    }
  }, [filtroTipo]);

  const handleEliminar = useCallback(
    async (id: number) => {
      if (!confirm("¿Eliminar este certificado? Esta acción no se puede deshacer.")) return;
      const res = await fetch(`/api/certificados/${id}`, { method: "DELETE" });
      if (res.ok) {
        setCertificados((prev) => prev.filter((c) => c.id !== id));
      } else {
        alert("Error al eliminar el certificado");
      }
    },
    []
  );

  useEffect(() => {
    cargar();
  }, [cargar]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-4 items-end">
        <div>
          <Label className="text-xs">Tipo de licencia</Label>
          <select
            value={filtroTipo}
            onChange={(e) => setFiltroTipo(e.target.value)}
            className="mt-1 h-9 rounded-md border border-input bg-transparent px-3 text-sm"
          >
            <option value="">Todos</option>
            {Object.entries(TIPO_LICENCIA_LABEL).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-gray-500">Cargando...</p>
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Legajo</TableHead>
                <TableHead>Empleado</TableHead>
                <TableHead>Tipo licencia</TableHead>
                <TableHead>Fecha carga</TableHead>
                <TableHead>Tipo archivo</TableHead>
                <TableHead>Etapa</TableHead>
                <TableHead className="w-24">Ver / Descargar</TableHead>
                {puedeEliminar && <TableHead className="w-24">Eliminar</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {certificados.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={puedeEliminar ? 8 : 7} className="text-center text-gray-500 py-8">
                    No hay certificados cargados.
                  </TableCell>
                </TableRow>
              ) : (
                certificados.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>{c.legajo.numeroLegajo}</TableCell>
                    <TableCell>{c.legajo.apellidos}, {c.legajo.nombres}</TableCell>
                    <TableCell>{TIPO_LICENCIA_LABEL[c.licencia.tipoLicencia] ?? c.licencia.tipoLicencia}</TableCell>
                    <TableCell>{formatearFechaLicencia(c.fechaCarga)}</TableCell>
                    <TableCell>{c.tipoArchivo}</TableCell>
                    <TableCell>{c.etapa === "INICIO" ? "Inicio" : "Cierre"}</TableCell>
                    <TableCell>
                      <a
                        href={`/api/certificados/${c.id}/download`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-green-600 hover:underline text-sm"
                      >
                        <Download className="h-4 w-4" />
                        Ver
                      </a>
                    </TableCell>
                    {puedeEliminar && (
                      <TableCell>
                        <button
                          onClick={() => handleEliminar(c.id)}
                          className="text-red-500 hover:text-red-700 text-xs inline-flex items-center gap-1"
                          title="Eliminar certificado"
                        >
                          <Trash2 className="w-4 h-4" />
                          Eliminar
                        </button>
                      </TableCell>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
