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
import type { Acta } from "./types";

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const TZ = "America/Argentina/Buenos_Aires";

function formatFecha(iso: string): string {
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

type ModalEditarActaProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  acta: Acta | null;
  onSuccess: () => void;
  showMessage: (type: "ok" | "error", text: string) => void;
};

export function ModalEditarActa({
  open,
  onOpenChange,
  acta,
  onSuccess,
  showMessage,
}: ModalEditarActaProps) {
  const [titulo, setTitulo] = useState("");
  const [fechaActa, setFechaActa] = useState("");
  const [quitarArchivo, setQuitarArchivo] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [drag, setDrag] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (acta) {
      setTitulo(acta.titulo);
      setFechaActa(formatFecha(acta.fechaActa));
      setQuitarArchivo(false);
      setFile(null);
    }
  }, [acta, open]);

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setFile(null);
      setQuitarArchivo(false);
    }
    onOpenChange(next);
  };

  const save = async () => {
    if (!acta) return;
    if (!titulo.trim()) {
      showMessage("error", "El título del acta es obligatorio.");
      return;
    }
    const [d, m, y] = fechaActa.split("/").map((x) => parseInt(x, 10));
    if (!d || !m || !y) {
      showMessage("error", "La fecha del acta es obligatoria (DD/MM/YYYY).");
      return;
    }
    if (file && file.size > MAX_FILE_SIZE) {
      showMessage("error", "El archivo no puede superar 10 MB.");
      return;
    }
    if (file && !file.name.toLowerCase().endsWith(".docx")) {
      showMessage("error", "Solo se permiten archivos .docx.");
      return;
    }

    setSaving(true);
    try {
      const form = new FormData();
      form.set("titulo", titulo.trim());
      form.set("fechaActa", fechaActa);
      if (quitarArchivo) form.set("quitarArchivo", "true");
      if (file && file.size > 0) form.set("file", file);

      const res = await fetch(`/api/secretaria/actas/${acta.id}`, {
        method: "PUT",
        body: form,
      });
      const data = await res.json();
      if (!res.ok) {
        showMessage("error", data.error || "Error al actualizar");
        return;
      }
      showMessage("ok", "Acta actualizada correctamente.");
      handleOpenChange(false);
      onSuccess();
    } finally {
      setSaving(false);
    }
  };

  if (!acta) return null;

  const tieneArchivo = acta.urlArchivo && acta.nombreArchivo && !quitarArchivo;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Editar acta</DialogTitle>
          <DialogDescription>
            Modificá título, fecha y archivo adjunto si corresponde.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Título del acta *
            </label>
            <textarea
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              rows={3}
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Fecha del acta * (DD/MM/YYYY)
            </label>
            <input
              type="text"
              value={fechaActa}
              onChange={(e) => setFechaActa(e.target.value)}
              placeholder="DD/MM/YYYY"
              className="w-full h-9 rounded-md border border-gray-300 bg-white px-3 text-sm"
            />
          </div>
          {acta.urlArchivo && acta.nombreArchivo && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Archivo actual
              </label>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm text-gray-600">{acta.nombreArchivo}</span>
                {!quitarArchivo && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="text-red-600 border-red-200 hover:bg-red-50"
                    onClick={() => setQuitarArchivo(true)}
                  >
                    Quitar archivo
                  </Button>
                )}
                {quitarArchivo && (
                  <span className="text-sm text-gray-500">(Se quitará al guardar)</span>
                )}
              </div>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {tieneArchivo ? "Reemplazar con otro .docx (opcional)" : "Adjuntar .docx (opcional)"}
            </label>
            <div
              className={`border-2 border-dashed rounded-lg p-4 text-center transition-colors ${
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
                id="modal-editar-acta-file"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
              <label htmlFor="modal-editar-acta-file" className="cursor-pointer">
                {file ? (
                  <span className="text-sm text-[#388E3C] font-medium">{file.name}</span>
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
              "Guardar cambios"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
