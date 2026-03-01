"use client";

import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Eye, Pencil, Trash2, Loader2, FileText } from "lucide-react";
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

type DocumentosTablaProps = {
  documentos: DocumentoLegislacion[];
  loading: boolean;
  canEdit: boolean;
  onVer: (doc: DocumentoLegislacion) => void;
  onEditar: (doc: DocumentoLegislacion) => void;
  onEliminar: (doc: DocumentoLegislacion) => void;
  onDescargar: (doc: DocumentoLegislacion) => void;
};

export function DocumentosTabla({
  documentos,
  loading,
  canEdit,
  onVer,
  onEditar,
  onEliminar,
  onDescargar,
}: DocumentosTablaProps) {
  return (
    <div className="border rounded-lg overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Título</TableHead>
            <TableHead>Categoría</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead>Fecha doc.</TableHead>
            <TableHead>Fecha carga</TableHead>
            <TableHead className="text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            <TableRow>
              <TableCell colSpan={6} className="text-center py-8">
                <Loader2 className="h-6 w-6 animate-spin mx-auto text-gray-400" />
              </TableCell>
            </TableRow>
          ) : documentos.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                No hay documentos.
              </TableCell>
            </TableRow>
          ) : (
            documentos.map((doc) => (
              <TableRow key={doc.id}>
                <TableCell className="font-medium max-w-[220px] truncate" title={doc.titulo}>
                  {doc.titulo}
                </TableCell>
                <TableCell className="text-gray-600">
                  {doc.categoria?.nombre ?? "—"}
                </TableCell>
                <TableCell>
                  <span className="inline-flex items-center gap-1">
                    {doc.tipoArchivo === "PDF" ? (
                      <span className="text-red-600" title="PDF">PDF</span>
                    ) : (
                      <FileText className="h-4 w-4 text-blue-600" aria-label="DOCX" />
                    )}
                    {doc.tipoArchivo}
                  </span>
                </TableCell>
                <TableCell>{formatFecha(doc.fechaDocumento)}</TableCell>
                <TableCell className="text-gray-600 text-sm">
                  {formatFechaHora(doc.creadoEn)}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0"
                      onClick={() => onVer(doc)}
                      title="Ver"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    {canEdit && (
                      <>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0"
                          onClick={() => onEditar(doc)}
                          title="Editar"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0 text-red-600 hover:bg-red-50"
                          onClick={() => onEliminar(doc)}
                          title="Eliminar"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                    <Button
                      size="sm"
                      variant="link"
                      className="h-8 p-0 text-[#388E3C]"
                      onClick={() => onDescargar(doc)}
                      title="Descargar"
                    >
                      {doc.nombreArchivo}
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
