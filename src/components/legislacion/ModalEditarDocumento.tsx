"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";
import type { CategoriaLegislacion, DocumentoLegislacion, SeccionLegislacion } from "./types";

const MAX_FILE_SIZE = 20 * 1024 * 1024;
const TZ = "America/Argentina/Buenos_Aires";

function formatFecha(iso: string | null): string {
  if (!iso) return "";
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

type ModalEditarDocumentoProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documento: DocumentoLegislacion | null;
  categorias: CategoriaLegislacion[];
  onSuccess: () => void;
  showMessage: (type: "ok" | "error", text: string) => void;
};

export function ModalEditarDocumento({
  open,
  onOpenChange,
  documento,
  categorias,
  onSuccess,
  showMessage,
}: ModalEditarDocumentoProps) {
  const [titulo, setTitulo] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [categoriaId, setCategoriaId] = useState("");
  const [fechaDocumento, setFechaDocumento] = useState("");
  const [quitarArchivo, setQuitarArchivo] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [drag, setDrag] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (documento) {
      setTitulo(documento.titulo);
      setDescripcion(documento.descripcion || "");
      setCategoriaId(documento.categoriaId ? String(documento.categoriaId) : "");
      setFechaDocumento(formatFecha(documento.fechaDocumento));
      setQuitarArchivo(false);
      setFile(null);
    }
  }, [documento, open]);

  const handleOpenChange = (next: boolean) => {
    if (!next) setFile(null);
    onOpenChange(next);
  };

  const save = async () => {
    if (!documento) return;
    if (!titulo.trim()) {
      showMessage("error", "El título es obligatorio.");
      return;
    }
    if (quitarArchivo && (!file || file.size === 0)) {
      showMessage("error", "Al quitar el archivo actual debes seleccionar uno nuevo.");
      return;
    }
    if (file && file.size > 0) {
      const name = file.name.toLowerCase();
      if (!name.endsWith(".pdf") && !name.endsWith(".docx")) {
        showMessage("error", "Solo se permiten PDF o DOCX.");
        return;
      }
      if (file.size > MAX_FILE_SIZE) {
        showMessage("error", "El archivo no puede superar 20 MB.");
        return;
      }
    }

    setSaving(true);
    try {
      const form = new FormData();
      form.set("titulo", titulo.trim());
      form.set("descripcion", descripcion.trim());
      if (categoriaId && categoriaId !== "todos") form.set("categoriaId", categoriaId);
      else form.set("categoriaId", "todos");
      form.set("fechaDocumento", fechaDocumento);
      if (quitarArchivo) form.set("quitarArchivo", "true");
      if (file && file.size > 0) form.set("file", file);

      const res = await fetch(`/api/legislacion/${documento.id}`, { method: "PUT", body: form });
      const data = await res.json();
      if (!res.ok) {
        showMessage("error", data.error || "Error al actualizar");
        return;
      }
      showMessage("ok", "Documento actualizado correctamente.");
      handleOpenChange(false);
      onSuccess();
    } finally {
      setSaving(false);
    }
  };

  if (!documento) return null;
  const activas = categorias.filter((c) => c.activo);
  const tieneArchivo = documento.urlArchivo && documento.nombreArchivo && !quitarArchivo;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Editar documento</DialogTitle>
          <DialogDescription>
            Modificá título, descripción, categoría y archivo si corresponde.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Título *</label>
            <input
              type="text"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              className="w-full h-9 rounded-md border border-gray-300 px-3 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
            <textarea
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              rows={2}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Categoría</label>
            <select
              value={categoriaId}
              onChange={(e) => setCategoriaId(e.target.value)}
              className="w-full h-9 rounded-md border border-gray-300 bg-white px-3 text-sm"
            >
              <option value="">Ninguna</option>
              {activas.map((c) => (
                <option key={c.id} value={c.id}>{c.nombre}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Fecha del documento (DD/MM/YYYY)</label>
            <input
              type="text"
              value={fechaDocumento}
              onChange={(e) => setFechaDocumento(e.target.value)}
              placeholder="DD/MM/YYYY"
              className="w-full h-9 rounded-md border border-gray-300 px-3 text-sm"
            />
          </div>
          {documento.urlArchivo && documento.nombreArchivo && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Archivo actual</label>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm text-gray-600">{documento.nombreArchivo}</span>
                {!quitarArchivo && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-red-600 border-red-200 hover:bg-red-50"
                    onClick={() => setQuitarArchivo(true)}
                  >
                    Quitar archivo
                  </Button>
                )}
                {quitarArchivo && (
                  <span className="text-sm text-gray-500">(Seleccioná un archivo nuevo abajo)</span>
                )}
              </div>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {tieneArchivo ? "Reemplazar con otro archivo (opcional)" : "Archivo * (PDF o DOCX)"}
            </label>
            <div
              className={`border-2 border-dashed rounded-lg p-4 text-center transition-colors ${
                drag ? "border-[#4CAF50] bg-[#E8F5E9]" : "border-gray-300 bg-gray-50"
              }`}
              onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
              onDragLeave={() => setDrag(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDrag(false);
                const f = e.dataTransfer.files[0];
                if (f && (f.name.toLowerCase().endsWith(".pdf") || f.name.toLowerCase().endsWith(".docx")))
                  setFile(f);
              }}
            >
              <input
                type="file"
                accept=".pdf,.docx"
                className="hidden"
                id="modal-editar-doc-file"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
              <label htmlFor="modal-editar-doc-file" className="cursor-pointer">
                {file ? (
                  <span className="text-sm text-[#388E3C] font-medium">{file.name}</span>
                ) : (
                  <span className="text-sm text-gray-500">Arrastrá un PDF o DOCX o hacé clic</span>
                )}
              </label>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>Cancelar</Button>
          <Button className="bg-[#4CAF50] hover:bg-[#388E3C]" onClick={save} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Guardar cambios"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
