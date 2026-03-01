"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { FilePlus, Loader2 } from "lucide-react";
import type { CategoriaLegislacion, SeccionLegislacion } from "./types";

const MAX_FILE_SIZE = 20 * 1024 * 1024;

type ModalNuevoDocumentoProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  seccion: SeccionLegislacion;
  categorias: CategoriaLegislacion[];
  onSuccess: () => void;
  showMessage: (type: "ok" | "error", text: string) => void;
};

export function ModalNuevoDocumento({
  open,
  onOpenChange,
  seccion,
  categorias,
  onSuccess,
  showMessage,
}: ModalNuevoDocumentoProps) {
  const [titulo, setTitulo] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [categoriaId, setCategoriaId] = useState("");
  const [fechaDocumento, setFechaDocumento] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [drag, setDrag] = useState(false);
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setTitulo("");
    setDescripcion("");
    setCategoriaId("");
    setFechaDocumento("");
    setFile(null);
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  };

  const save = async () => {
    if (!titulo.trim()) {
      showMessage("error", "El título es obligatorio.");
      return;
    }
    if (!file || file.size === 0) {
      showMessage("error", "Debe seleccionar un archivo PDF o DOCX.");
      return;
    }
    const name = file.name.toLowerCase();
    if (!name.endsWith(".pdf") && !name.endsWith(".docx")) {
      showMessage("error", "Solo se permiten archivos PDF o DOCX.");
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      showMessage("error", "El archivo no puede superar 20 MB.");
      return;
    }

    setSaving(true);
    try {
      const form = new FormData();
      form.set("titulo", titulo.trim());
      form.set("descripcion", descripcion.trim());
      if (categoriaId && categoriaId !== "todos") form.set("categoriaId", categoriaId);
      form.set("fechaDocumento", fechaDocumento);
      form.set("seccion", seccion);
      form.set("file", file);

      const res = await fetch("/api/legislacion", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) {
        showMessage("error", data.error || "Error al crear");
        return;
      }
      showMessage("ok", "Documento creado correctamente.");
      handleOpenChange(false);
      onSuccess();
    } finally {
      setSaving(false);
    }
  };

  const activas = categorias.filter((c) => c.activo);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Nuevo documento</DialogTitle>
          <DialogDescription>
            Título, descripción, categoría opcional y archivo PDF o DOCX (máx. 20 MB).
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
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Archivo * (PDF o DOCX, máx. 20 MB)</label>
            <div
              className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
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
                id="modal-nuevo-doc-file"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
              <label htmlFor="modal-nuevo-doc-file" className="cursor-pointer">
                {file ? (
                  <span className="text-sm text-[#388E3C] font-medium">{file.name}</span>
                ) : (
                  <span className="text-sm text-gray-500">Arrastrá un PDF o DOCX o hacé clic para elegir</span>
                )}
              </label>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>Cancelar</Button>
          <Button className="bg-[#4CAF50] hover:bg-[#388E3C]" onClick={save} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <><FilePlus className="h-4 w-4 mr-1" /> Guardar</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
