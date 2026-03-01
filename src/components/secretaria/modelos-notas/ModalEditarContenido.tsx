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
import { Loader2, AlertCircle } from "lucide-react";

type ModalEditarContenidoProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  modeloId: number | null;
  modeloNombre: string;
  onSuccess: () => void;
  showMessage: (type: "ok" | "error", text: string) => void;
};

export function ModalEditarContenido({
  open,
  onOpenChange,
  modeloId,
  modeloNombre,
  onSuccess,
  showMessage,
}: ModalEditarContenidoProps) {
  const [texto, setTexto] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && modeloId != null) {
      setTexto("");
      setLoading(true);
      fetch(`/api/secretaria/modelos-nota/${modeloId}/contenido`)
        .then((res) => res.json())
        .then((data) => {
          if (data.text != null) setTexto(data.text);
          else showMessage("error", data.error || "Error al cargar contenido");
        })
        .catch(() => showMessage("error", "Error al cargar contenido"))
        .finally(() => setLoading(false));
    }
  }, [open, modeloId, showMessage]);

  const guardarCambios = async () => {
    if (modeloId == null) return;
    setSaving(true);
    try {
      const res = await fetch(
        `/api/secretaria/modelos-nota/${modeloId}/contenido`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ texto }),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        showMessage("error", data.error || "Error al guardar");
        return;
      }
      showMessage("ok", "Contenido guardado.");
      onOpenChange(false);
      onSuccess();
    } finally {
      setSaving(false);
    }
  };

  const cancelar = () => {
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Editando: {modeloNombre}</DialogTitle>
          <DialogDescription>
            Texto extraído del DOCX con mammoth. Podés modificarlo libremente y
            guardar para regenerar el .docx.
          </DialogDescription>
        </DialogHeader>

        <p className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          <AlertCircle className="h-4 w-4 shrink-0" />
          El formato original del documento puede variar al editar.
        </p>

        <div className="flex-1 min-h-0 flex flex-col py-2">
          {loading ? (
            <div className="flex items-center gap-2 text-gray-500 py-8">
              <Loader2 className="h-5 w-5 animate-spin" />
              Cargando contenido...
            </div>
          ) : (
            <textarea
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              className="w-full min-h-[300px] p-4 border border-gray-300 rounded-lg text-sm font-mono resize-y"
              placeholder="Texto del documento..."
            />
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={cancelar}>
            Cancelar
          </Button>
          <Button
            className="bg-[#4CAF50] hover:bg-[#388E3C]"
            onClick={guardarCambios}
            disabled={loading || saving}
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
