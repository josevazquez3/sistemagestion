"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Upload, Loader2 } from "lucide-react";
import type { TipoNota } from "./types";

type ModalSubirModeloProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tiposActivos: TipoNota[];
  onSuccess: () => void;
  showMessage: (type: "ok" | "error", text: string) => void;
};

export function ModalSubirModelo({
  open,
  onOpenChange,
  tiposActivos,
  onSuccess,
  showMessage,
}: ModalSubirModeloProps) {
  const [nombre, setNombre] = useState("");
  const [tipoId, setTipoId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [drag, setDrag] = useState(false);
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setNombre("");
    setTipoId(tiposActivos.length ? String(tiposActivos[0].id) : "");
    setFile(null);
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  };

  const save = async () => {
    if (!tipoId || !nombre.trim()) {
      showMessage("error", "Tipo de nota y nombre son obligatorios.");
      return;
    }
    if (!file || file.size === 0) {
      showMessage("error", "Seleccioná un archivo .docx.");
      return;
    }
    if (!file.name.toLowerCase().endsWith(".docx")) {
      showMessage("error", "Solo se permiten archivos .docx.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      showMessage("error", "El archivo no puede superar 10 MB.");
      return;
    }
    setSaving(true);
    try {
      const form = new FormData();
      form.set("tipoNotaId", tipoId);
      form.set("nombre", nombre.trim());
      form.set("file", file);
      const res = await fetch("/api/secretaria/modelos-nota", {
        method: "POST",
        body: form,
      });
      const data = await res.json();
      if (!res.ok) {
        showMessage("error", data.error || "Error al subir");
        return;
      }
      showMessage("ok", "Modelo subido correctamente.");
      handleOpenChange(false);
      onSuccess();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Subir modelo de nota</DialogTitle>
          <DialogDescription>
            Tipo, nombre y archivo .docx (máx. 10 MB).
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tipo de nota *
            </label>
            <select
              value={tipoId}
              onChange={(e) => setTipoId(e.target.value)}
              className="w-full h-9 rounded-md border border-gray-300 bg-white px-3 text-sm"
            >
              <option value="">Seleccionar...</option>
              {tiposActivos.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nombre}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nombre del modelo *
            </label>
            <Input
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Nombre descriptivo"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Archivo .docx * (máx. 10 MB)
            </label>
            <div
              className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                drag ? "border-[#4CAF50] bg-[#E8F5E9]" : "border-gray-300 bg-gray-50"
              }`}
              onDragOver={(e) => {
                e.preventDefault();
                setDrag(true);
              }}
              onDragLeave={() => setDrag(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDrag(false);
                const f = e.dataTransfer.files[0];
                if (f?.name.toLowerCase().endsWith(".docx")) setFile(f);
              }}
            >
              <input
                type="file"
                accept=".docx"
                className="hidden"
                id="modal-subir-file"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
              <label htmlFor="modal-subir-file" className="cursor-pointer">
                {file ? (
                  <span className="text-sm text-[#388E3C] font-medium">
                    {file.name}
                  </span>
                ) : (
                  <span className="text-sm text-gray-500">
                    Arrastrá un .docx o hacé clic para elegir
                  </span>
                )}
              </label>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            className="bg-[#4CAF50] hover:bg-[#388E3C]"
            onClick={save}
            disabled={saving}
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <Upload className="h-4 w-4 mr-1" />
                Guardar
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
