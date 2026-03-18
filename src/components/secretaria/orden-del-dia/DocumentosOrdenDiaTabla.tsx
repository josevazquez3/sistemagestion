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
import { Eye, Pencil, Trash2, Download, Printer, Loader2, FileText } from "lucide-react";
import type { DocumentoOrdenDia } from "./types";
import { esDocFormatoAntiguo } from "@/lib/legales/modelosOficioWordShared";
import { formatearFechaUTC } from "@/lib/utils/fecha";

const TZ = "America/Argentina/Buenos_Aires";

function formatFecha(iso: string | null): string {
  if (!iso) return "—";
  try {
    return formatearFechaUTC(new Date(iso));
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

type DocumentosOrdenDiaTablaProps = {
  documentos: DocumentoOrdenDia[];
  loading: boolean;
  canEdit: boolean;
  onVer: (doc: DocumentoOrdenDia) => void;
  onEditar: (doc: DocumentoOrdenDia) => void;
  onEliminar: (doc: DocumentoOrdenDia) => void;
  onDescargar: (doc: DocumentoOrdenDia) => void;
  onImprimir: (doc: DocumentoOrdenDia) => void;
};

export function DocumentosOrdenDiaTabla({
  documentos,
  loading,
  canEdit,
  onVer,
  onEditar,
  onEliminar,
  onDescargar,
  onImprimir,
}: DocumentosOrdenDiaTablaProps) {
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
                No hay documentos cargados
              </TableCell>
            </TableRow>
          ) : (
            documentos.map((doc) => {
              const esDoc = esDocFormatoAntiguo(doc.nombreArchivo);
              return (
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
                    ) : doc.tipoArchivo === "DOC" || esDoc ? (
                      <span className="inline-flex items-center gap-1 rounded bg-[#E8F5E9] px-1.5 py-0.5 text-[10px] font-semibold uppercase text-[#2E7D32]">
                        <FileText className="h-3.5 w-3.5 shrink-0" aria-hidden />
                        DOC
                      </span>
                    ) : (
                      <span className="text-blue-600 inline-flex items-center gap-1">
                        <FileText className="h-4 w-4 shrink-0" aria-hidden />
                        DOCX
                      </span>
                    )}
                  </span>
                </TableCell>
                <TableCell>{formatFecha(doc.fechaDocumento)}</TableCell>
                <TableCell className="text-gray-600 text-sm">
                  {formatFechaHora(doc.creadoEn)}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    <span
                      className="inline-flex"
                      title={
                        esDoc
                          ? "Vista previa no disponible para archivos .doc"
                          : "Ver documento"
                      }
                    >
                      <Button
                        size="sm"
                        variant="ghost"
                        className={`h-8 w-8 p-0 shrink-0 ${esDoc ? "opacity-40 cursor-not-allowed" : ""}`}
                        disabled={esDoc}
                        onClick={() => !esDoc && onVer(doc)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </span>
                    {canEdit && (
                      <>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0 shrink-0"
                          onClick={() => onEditar(doc)}
                          title="Editar"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0 shrink-0 text-red-600 hover:bg-red-50"
                          onClick={() => onEliminar(doc)}
                          title="Eliminar"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      className={`h-8 w-8 p-0 shrink-0 ${
                        doc.tipoArchivo === "PDF"
                          ? "text-red-600 hover:bg-red-50"
                          : "text-blue-600 hover:bg-blue-50"
                      }`}
                      onClick={() => onDescargar(doc)}
                      title={`Descargar ${doc.nombreArchivo}`}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                    <span
                      className="inline-flex"
                      title={
                        esDoc
                          ? "Impresión no disponible para archivos .doc"
                          : `Imprimir ${doc.nombreArchivo ?? ""}`
                      }
                    >
                      <Button
                        size="sm"
                        variant="ghost"
                        className={`h-8 w-8 p-0 shrink-0 text-gray-600 hover:bg-gray-100 ${esDoc ? "opacity-40 cursor-not-allowed" : ""}`}
                        disabled={esDoc}
                        onClick={() => !esDoc && onImprimir(doc)}
                      >
                        <Printer className="h-4 w-4" />
                      </Button>
                    </span>
                  </div>
                </TableCell>
              </TableRow>
            );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
}
