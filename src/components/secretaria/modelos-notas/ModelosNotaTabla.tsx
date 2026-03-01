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
import { Checkbox } from "@/components/ui/checkbox";
import { Pencil, Trash2, Download, FileText, Loader2 } from "lucide-react";
import type { ModeloNota } from "./types";

function formatFechaArgentina(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("es-AR", {
      timeZone: "America/Argentina/Buenos_Aires",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return iso.slice(0, 10);
  }
}

type ModelosNotaTablaProps = {
  modelos: ModeloNota[];
  loading: boolean;
  selectedIds: Set<number>;
  onSelectAll: () => void;
  onSelectOne: (id: number) => void;
  onEdit: (m: ModeloNota) => void;
  onEditContenido: (m: ModeloNota) => void;
  onDownload: (m: ModeloNota) => void;
  onDelete: (m: ModeloNota) => void;
  onExportZip: () => void;
  onDeleteSelected: () => void;
};

export function ModelosNotaTabla({
  modelos,
  loading,
  selectedIds,
  onSelectAll,
  onSelectOne,
  onEdit,
  onEditContenido,
  onDownload,
  onDelete,
  onExportZip,
  onDeleteSelected,
}: ModelosNotaTablaProps) {
  const allSelected =
    modelos.length > 0 && selectedIds.size === modelos.length;

  return (
    <div className="space-y-4">
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-4 rounded-lg border border-[#4CAF50]/30 bg-[#E8F5E9] px-4 py-2">
          <span className="text-sm font-medium text-gray-700">
            {selectedIds.size} modelo(s) seleccionado(s)
          </span>
          <Button size="sm" variant="outline" onClick={onExportZip}>
            <Download className="h-4 w-4 mr-1" />
            Exportar seleccionados DOCX
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="text-red-600 border-red-200 hover:bg-red-50"
            onClick={onDeleteSelected}
          >
            <Trash2 className="h-4 w-4 mr-1" />
            Eliminar seleccionados
          </Button>
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-gray-500 py-8">
          <Loader2 className="h-5 w-5 animate-spin" />
          Cargando modelos...
        </div>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={onSelectAll}
                    aria-label="Seleccionar todos"
                  />
                </TableHead>
                <TableHead>Tipo de nota</TableHead>
                <TableHead>Nombre del modelo</TableHead>
                <TableHead>Archivo</TableHead>
                <TableHead>Fecha carga</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {modelos.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="text-center text-gray-500 py-8"
                  >
                    No hay modelos. Subí uno con &quot;Subir modelo&quot;.
                  </TableCell>
                </TableRow>
              ) : (
                modelos.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell>
                      <Checkbox
                        checked={selectedIds.has(m.id)}
                        onCheckedChange={() => onSelectOne(m.id)}
                        aria-label={`Seleccionar ${m.nombre}`}
                      />
                    </TableCell>
                    <TableCell>{m.tipoNota.nombre}</TableCell>
                    <TableCell>{m.nombre}</TableCell>
                    <TableCell>
                      <a
                        href={`/api/secretaria/modelos-nota/${m.id}/download`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#388E3C] hover:underline"
                      >
                        {m.nombreArchivo}
                      </a>
                    </TableCell>
                    <TableCell className="text-gray-600">
                      {formatFechaArgentina(m.creadoEn)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onEdit(m)}
                        title="Editar modelo"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onEditContenido(m)}
                        title="Editar contenido DOCX"
                      >
                        <FileText className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onDownload(m)}
                        title="Descargar DOCX"
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onDelete(m)}
                        className="text-red-600"
                        title="Eliminar"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
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
