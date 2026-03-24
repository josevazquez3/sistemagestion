"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { InputFecha } from "@/components/ui/InputFecha";
import { FolderUp, Loader2, X } from "lucide-react";
import { createHistorialTsdMasivo } from "@/lib/actions/legal-historial-tsd.actions";

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_FILES = 50;

function nombreSinExtension(name: string): string {
  return name.replace(/\.(pdf|docx|doc)$/i, "") || name;
}

function archivoValido(file: File): boolean {
  const n = file.name.toLowerCase();
  if (!(n.endsWith(".pdf") || n.endsWith(".doc") || n.endsWith(".docx"))) return false;
  if (file.size > MAX_FILE_SIZE) return false;
  return true;
}

type RowCarga = {
  key: string;
  file: File;
  titulo: string;
  fechaOficio: string;
};

type ModalCargaMasivaTsdProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  showMessage: (type: "ok" | "error", text: string) => void;
};

export function ModalCargaMasivaTsd({
  open,
  onOpenChange,
  onSuccess,
  showMessage,
}: ModalCargaMasivaTsdProps) {
  const [rows, setRows] = useState<RowCarga[]>([]);
  const [uploading, setUploading] = useState(false);

  const fechaDefaultHoy = useCallback(() => {
    const hoy = new Date();
    return `${String(hoy.getDate()).padStart(2, "0")}/${String(hoy.getMonth() + 1).padStart(2, "0")}/${hoy.getFullYear()}`;
  }, []);

  const reset = useCallback(() => {
    setRows([]);
    setUploading(false);
  }, []);

  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (!next) reset();
      onOpenChange(next);
    },
    [onOpenChange, reset]
  );

  const addFiles = useCallback(
    (files: FileList | null) => {
      if (!files?.length) return;
      const nuevos: RowCarga[] = [];
      const existentes = new Set(rows.map((r) => r.file.name.toLowerCase()));
      const defFecha = fechaDefaultHoy();
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (rows.length + nuevos.length >= MAX_FILES) {
          showMessage("error", `Máximo ${MAX_FILES} archivos por carga.`);
          break;
        }
        const keyLower = file.name.toLowerCase();
        if (existentes.has(keyLower) || nuevos.some((n) => n.file.name.toLowerCase() === keyLower)) {
          continue;
        }
        if (!archivoValido(file)) {
          showMessage("error", `Archivo no válido o demasiado grande: ${file.name}`);
          continue;
        }
        existentes.add(keyLower);
        nuevos.push({
          key: `${Date.now()}_${Math.random().toString(36).slice(2)}`,
          file,
          titulo: nombreSinExtension(file.name),
          fechaOficio: defFecha,
        });
      }
      if (nuevos.length) setRows((prev) => [...prev, ...nuevos]);
    },
    [rows, fechaDefaultHoy, showMessage]
  );

  const quitarFila = useCallback((key: string) => {
    setRows((prev) => prev.filter((r) => r.key !== key));
  }, []);

  const setTitulo = useCallback((key: string, titulo: string) => {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, titulo } : r)));
  }, []);

  const setFecha = useCallback((key: string, fechaOficio: string) => {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, fechaOficio } : r)));
  }, []);

  const allValid = rows.every(
    (r) => r.titulo.trim() && /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(r.fechaOficio.trim())
  );
  const canUpload = rows.length >= 1 && allValid && !uploading;

  const subirTodos = async () => {
    if (!canUpload) return;
    setUploading(true);
    try {
      const items = rows.map((r) => ({
        titulo: r.titulo.trim(),
        fechaOficioStr: r.fechaOficio.trim(),
        archivo: r.file,
      }));
      const res = await createHistorialTsdMasivo(items);
      const detalleFallos = res.fallidos
        .map((f) => `${f.titulo} (${f.error})`)
        .join("; ");
      if (res.ok > 0) {
        const base = `Se subieron ${res.ok} archivo${res.ok === 1 ? "" : "s"} correctamente.`;
        showMessage(
          "ok",
          res.fallidos.length ? `${base} Fallidos: ${detalleFallos}` : base
        );
        handleOpenChange(false);
        onSuccess();
      } else {
        showMessage(
          "error",
          detalleFallos || "No se pudo subir ningún archivo."
        );
      }
    } finally {
      setUploading(false);
    }
  };

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Carga masiva — Historial Exptes. TSD</DialogTitle>
          <DialogDescription>
            Subí varios archivos PDF o Word. El nombre del archivo se usa como título (sin extensión);
            indicá la fecha de la sentencia de cada uno.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto space-y-4 py-2">
          <div
            className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center bg-gray-50 hover:bg-gray-100 transition-colors cursor-pointer"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              addFiles(e.dataTransfer.files);
            }}
            onClick={() => document.getElementById("carga-masiva-tsd-input")?.click()}
          >
            <input
              id="carga-masiva-tsd-input"
              type="file"
              accept=".pdf,.doc,.docx"
              multiple
              className="hidden"
              onChange={(e) => addFiles(e.target.files)}
            />
            <FolderUp className="h-10 w-10 mx-auto text-gray-400 mb-2" />
            <p className="text-gray-600">Arrastrá archivos o hacé clic para seleccionar</p>
            <p className="text-sm text-gray-500 mt-1">
              PDF, DOC, DOCX — máx. 10 MB c/u — hasta {MAX_FILES} archivos
            </p>
          </div>

          {rows.length > 0 && (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10" />
                    <TableHead>Archivo</TableHead>
                    <TableHead>Título</TableHead>
                    <TableHead>Fecha sentencia</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r.key}>
                      <TableCell className="align-middle">
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0 text-red-600"
                          onClick={() => quitarFila(r.key)}
                          title="Quitar"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </TableCell>
                      <TableCell className="font-medium text-sm text-gray-700 max-w-[140px] truncate">
                        {r.file.name}
                      </TableCell>
                      <TableCell>
                        <input
                          type="text"
                          value={r.titulo}
                          onChange={(e) => setTitulo(r.key, e.target.value)}
                          className="w-full min-w-[160px] rounded border border-gray-300 px-2 py-1 text-sm"
                        />
                      </TableCell>
                      <TableCell>
                        <InputFecha
                          value={r.fechaOficio}
                          onChange={(v) => setFecha(r.key, v)}
                          placeholder="DD/MM/YYYY"
                          className="w-full min-w-[120px] rounded border border-gray-300 px-2 py-1 text-sm"
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            className="bg-[#4CAF50] hover:bg-[#388E3C]"
            disabled={!canUpload}
            onClick={subirTodos}
          >
            {uploading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Subiendo…
              </>
            ) : (
              "Subir todos"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
