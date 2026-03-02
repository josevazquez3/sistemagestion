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

const MAX_FILE_SIZE = 10 * 1024 * 1024;

function toDDMMYYYY(d: Date): string {
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

type ModalNuevoOficioProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  showMessage: (type: "ok" | "error", text: string) => void;
};

export function ModalNuevoOficio({
  open,
  onOpenChange,
  onSuccess,
  showMessage,
}: ModalNuevoOficioProps) {
  const [titulo, setTitulo] = useState("");
  const [fechaOficio, setFechaOficio] = useState(() => toDDMMYYYY(new Date()));
  const [file, setFile] = useState<File | null>(null);
  const [drag, setDrag] = useState(false);
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setTitulo("");
    setFechaOficio(toDDMMYYYY(new Date()));
    setFile(null);
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  };

  const save = async () => {
    if (!titulo.trim()) {
      showMessage("error", "El título del oficio es obligatorio.");
      return;
    }
    const [d, m, y] = fechaOficio.split("/").map((x) => parseInt(x, 10));
    if (!d || !m || !y) {
      showMessage("error", "La fecha del oficio es obligatoria (formato DD/MM/YYYY).");
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
      form.set("fechaOficio", fechaOficio);
      if (file && file.size > 0) form.set("file", file);

      const res = await fetch("/api/legales/historial-oficios", {
        method: "POST",
        body: form,
      });
      const data = await res.json();
      if (!res.ok) {
        showMessage("error", data.error || "Error al crear el oficio");
        return;
      }
      showMessage("ok", "Oficio creado correctamente.");
      handleOpenChange(false);
      onSuccess();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Nuevo Oficio</DialogTitle>
          <DialogDescription>
            Título, fecha y opcionalmente el archivo .docx del oficio.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Título del oficio *
            </label>
            <textarea
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Texto descriptivo del oficio"
              rows={3}
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Fecha del oficio * (DD/MM/YYYY)
            </label>
            <input
              type="text"
              value={fechaOficio}
              onChange={(e) => setFechaOficio(e.target.value)}
              placeholder="DD/MM/YYYY"
              className="w-full h-9 rounded-md border border-gray-300 bg-white px-3 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Archivo .docx (opcional, máx. 10 MB)
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
                id="modal-nuevo-oficio-file"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
              <label htmlFor="modal-nueva-acta-file" className="cursor-pointer">
                {file ? (
                  <span className="text-sm text-[#388E3C] font-medium">
                    {file.name}
                  </span>
                ) : (
                  <span className="text-sm text-gray-500">
                    Opcional. Podés adjuntar el archivo del oficio. Arrastrá un .docx o hacé clic para elegir.
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
                <FilePlus className="h-4 w-4 mr-1" />
                Guardar
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
