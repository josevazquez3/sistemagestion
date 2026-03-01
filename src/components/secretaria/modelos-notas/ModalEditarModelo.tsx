"use client";

import { useState, useEffect } from "react";
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
import { Loader2 } from "lucide-react";
import type { ModeloNota } from "./types";
import type { TipoNota } from "./types";

type ModalEditarModeloProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  modelo: ModeloNota | null;
  tipos: TipoNota[];
  onSuccess: () => void;
  showMessage: (type: "ok" | "error", text: string) => void;
};

export function ModalEditarModelo({
  open,
  onOpenChange,
  modelo,
  tipos,
  onSuccess,
  showMessage,
}: ModalEditarModeloProps) {
  const [nombre, setNombre] = useState("");
  const [tipoId, setTipoId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (modelo) {
      setNombre(modelo.nombre);
      setTipoId(String(modelo.tipoNotaId));
      setFile(null);
    }
  }, [modelo]);

  const save = async () => {
    if (!modelo || !nombre.trim()) return;
    setSaving(true);
    try {
      const form = new FormData();
      form.set("nombre", nombre.trim());
      form.set("tipoNotaId", tipoId);
      if (file && file.size > 0) form.set("file", file);
      const res = await fetch(`/api/secretaria/modelos-nota/${modelo.id}`, {
        method: "PUT",
        body: form,
      });
      const data = await res.json();
      if (!res.ok) {
        showMessage("error", data.error || "Error al actualizar");
        return;
      }
      showMessage("ok", "Modelo actualizado.");
      onOpenChange(false);
      onSuccess();
    } finally {
      setSaving(false);
    }
  };

  if (!modelo) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Editar modelo</DialogTitle>
          <DialogDescription>
            Nombre, tipo y opcionalmente reemplazar archivo.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nombre del modelo *
            </label>
            <Input
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tipo de nota
            </label>
            <select
              value={tipoId}
              onChange={(e) => setTipoId(e.target.value)}
              className="w-full h-9 rounded-md border border-gray-300 bg-white px-3 text-sm"
            >
              {tipos.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nombre}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Reemplazar archivo (opcional)
            </label>
            <Input
              type="file"
              accept=".docx"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            className="bg-[#4CAF50] hover:bg-[#388E3C]"
            onClick={save}
            disabled={saving}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Guardar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
