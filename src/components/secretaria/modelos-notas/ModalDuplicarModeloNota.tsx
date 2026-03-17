"use client";

import { useState } from "react";
import { Copy, X } from "lucide-react";

interface TipoNota {
  id: number;
  nombre: string;
}

interface ModeloOrigen {
  id: number;
  nombre: string;
  tipoNotaId: number;
}

interface Props {
  modelo: ModeloOrigen;
  tiposNota: TipoNota[];
  onClose: () => void;
  onGuardado: () => void;
  showMessage: (tipo: "ok" | "error", text: string) => void;
}

export function ModalDuplicarModeloNota({
  modelo,
  tiposNota,
  onClose,
  onGuardado,
  showMessage,
}: Props) {
  const [nombre, setNombre] = useState<string>(`${modelo.nombre} (copia)`);
  const [tipoNotaId, setTipoNotaId] = useState<number>(modelo.tipoNotaId);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string>("");

  const handleGuardar = async () => {
    const nombreTrim = nombre.trim();
    if (!nombreTrim) {
      setError("El nombre es requerido");
      return;
    }
    setCargando(true);
    setError("");
    try {
      const res = await fetch(`/api/secretaria/modelos-nota/${modelo.id}/duplicar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre: nombreTrim, tipoNotaId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = (data?.error as string) || "Error al duplicar el modelo.";
        setError(msg);
        showMessage("error", msg);
        return;
      }
      showMessage("ok", "Modelo duplicado correctamente.");
      onGuardado();
      onClose();
    } catch {
      const msg = "Error inesperado al duplicar el modelo.";
      setError(msg);
      showMessage("error", msg);
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b">
          <div className="flex items-center gap-2">
            <Copy className="w-5 h-5 text-emerald-600" />
            <div>
              <h2 className="text-base font-semibold text-gray-900">Duplicar modelo</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Se creará una copia independiente con su propio archivo DOCX.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nombre del modelo <span className="text-red-500">*</span>
            </label>
            <input
              autoFocus
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleGuardar()}
              className="w-full border border-emerald-500 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tipo de nota
            </label>
            <select
              value={tipoNotaId}
              onChange={(e) => setTipoNotaId(parseInt(e.target.value, 10))}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300"
            >
              {tiposNota.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nombre}
                </option>
              ))}
            </select>
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            <p className="text-xs text-amber-700">
              El archivo DOCX original se copiará automáticamente. Podrás editar esta copia sin
              afectar el modelo original.
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-2 p-5 border-t bg-gray-50 rounded-b-xl">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm rounded-lg border border-gray-300 hover:bg-gray-100 transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleGuardar}
            disabled={!nombre.trim() || cargando}
            className="px-4 py-2 text-sm rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            {cargando ? (
              <>
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Duplicando...
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                Duplicar
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

