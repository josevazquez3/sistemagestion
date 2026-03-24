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
import { FilePlus, Loader2 } from "lucide-react";
import { InputFecha } from "@/components/ui/InputFecha";
import type { HistorialTsdRow } from "./types";
import {
  createHistorialTsdDesdeForm,
  updateHistorialTsd,
} from "@/lib/actions/legal-historial-tsd.actions";

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const TZ = "America/Argentina/Buenos_Aires";

function toDDMMYYYYDesdeIso(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("es-AR", {
      timeZone: TZ,
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return "";
  }
}

function toDDMMYYYYHoy(): string {
  const d = new Date();
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

function archivoPermitido(file: File): boolean {
  const n = file.name.toLowerCase();
  return (
    n.endsWith(".pdf") ||
    n.endsWith(".doc") ||
    n.endsWith(".docx") ||
    file.type === "application/pdf" ||
    file.type === "application/msword" ||
    file.type ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  );
}

type ModalNuevoOficioTsdProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  modo: "crear" | "editar";
  registro: HistorialTsdRow | null;
  onSuccess: () => void;
  showMessage: (type: "ok" | "error", text: string) => void;
};

export function ModalNuevoOficioTsd({
  open,
  onOpenChange,
  modo,
  registro,
  onSuccess,
  showMessage,
}: ModalNuevoOficioTsdProps) {
  const [titulo, setTitulo] = useState("");
  const [fechaOficio, setFechaOficio] = useState(toDDMMYYYYHoy());
  const [file, setFile] = useState<File | null>(null);
  const [drag, setDrag] = useState(false);
  const [saving, setSaving] = useState(false);
  const [quitarArchivo, setQuitarArchivo] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (modo === "editar" && registro) {
      setTitulo(registro.titulo);
      setFechaOficio(toDDMMYYYYDesdeIso(registro.fechaOficio));
      setFile(null);
      setQuitarArchivo(false);
    } else if (modo === "crear") {
      setTitulo("");
      setFechaOficio(toDDMMYYYYHoy());
      setFile(null);
      setQuitarArchivo(false);
    }
  }, [open, modo, registro]);

  const reset = () => {
    setTitulo("");
    setFechaOficio(toDDMMYYYYHoy());
    setFile(null);
    setQuitarArchivo(false);
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
    const [d, m, y] = fechaOficio.split("/").map((x) => parseInt(x, 10));
    if (!d || !m || !y) {
      showMessage("error", "La fecha de la sentencia es obligatoria (formato DD/MM/YYYY).");
      return;
    }
    if (file && file.size > MAX_FILE_SIZE) {
      showMessage("error", "El archivo no puede superar 10 MB.");
      return;
    }
    if (file && !archivoPermitido(file)) {
      showMessage("error", "Solo se permiten PDF, DOC o DOCX.");
      return;
    }

    setSaving(true);
    try {
      if (modo === "crear") {
        const res = await createHistorialTsdDesdeForm({
          titulo: titulo.trim(),
          fechaOficioStr: fechaOficio,
          archivo: file && file.size > 0 ? file : undefined,
        });
        if (res.error) {
          showMessage("error", res.error);
          return;
        }
        showMessage("ok", "Registro creado correctamente.");
      } else if (registro) {
        const res = await updateHistorialTsd(registro.id, {
          titulo: titulo.trim(),
          fechaOficioStr: fechaOficio,
          archivo: file && file.size > 0 ? file : undefined,
          quitarArchivo,
        });
        if (res.error) {
          showMessage("error", res.error);
          return;
        }
        showMessage("ok", "Registro actualizado correctamente.");
      }
      handleOpenChange(false);
      onSuccess();
    } finally {
      setSaving(false);
    }
  };

  const tieneArchivoActual =
    modo === "editar" &&
    registro?.archivoUrl &&
    registro?.archivoNombre &&
    !quitarArchivo;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {modo === "crear" ? "Nuevo Expediente TSD" : "Editar Expediente TSD"}
          </DialogTitle>
          <DialogDescription>
            {modo === "crear"
              ? "Título, fecha de la sentencia y archivo opcional (PDF, Word)."
              : "Modificá los datos y guardá los cambios."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Título *
            </label>
            <textarea
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Descripción o referencia del expediente"
              rows={3}
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Fecha sentencia * (DD/MM/YYYY)
            </label>
            <InputFecha
              value={fechaOficio}
              onChange={setFechaOficio}
              placeholder="DD/MM/YYYY"
              className="w-full h-9 rounded-md border border-gray-300 bg-white px-3 text-sm"
            />
          </div>
          {tieneArchivoActual && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Archivo actual
              </label>
              <div className="flex flex-col gap-2">
                <a
                  href={registro!.archivoUrl!}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-[#388E3C] hover:underline font-medium"
                >
                  Ver archivo actual
                </a>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm text-gray-600">{registro!.archivoNombre}</span>
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
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {tieneArchivoActual
                ? "Reemplazar archivo (opcional)"
                : "Archivo (opcional, PDF / Word, máx. 10 MB)"}
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
                const f0 = e.dataTransfer.files[0];
                if (f0 && archivoPermitido(f0)) setFile(f0);
              }}
            >
              <input
                type="file"
                accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                className="hidden"
                id="modal-historial-tsd-file"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
              <label htmlFor="modal-historial-tsd-file" className="cursor-pointer">
                {file ? (
                  <span className="text-sm text-[#388E3C] font-medium">{file.name}</span>
                ) : (
                  <span className="text-sm text-gray-500">
                    Arrastrá un archivo o hacé clic para elegir (.pdf, .doc, .docx)
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
            ) : modo === "crear" ? (
              <>
                <FilePlus className="h-4 w-4 mr-1" />
                Guardar
              </>
            ) : (
              "Guardar cambios"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
