'use client';

import { useEffect, useState } from "react";
import { Minimize2, X, Save, Loader2, CheckCircle2 } from "lucide-react";
import { useEditoresDocxStore } from "@/lib/stores/editoresDocxStore";

interface TipoOficio {
  id: number;
  nombre: string;
}

interface Props {
  modeloId: number;
  tiposOficio: TipoOficio[];
  onModeloGuardado?: () => void;
  showMessage: (tipo: "ok" | "error", text: string) => void;
}

export function EditorDocxPanel({
  modeloId,
  tiposOficio,
  onModeloGuardado,
  showMessage,
}: Props) {
  const {
    editores,
    minimizarEditor,
    cerrarEditor,
    actualizarContenido,
    setGuardando,
    marcarGuardado,
  } = useEditoresDocxStore();

  const editor = editores.find((e) => e.modeloId === modeloId);

  const [modalGuardar, setModalGuardar] = useState(false);
  const [nombreGuardar, setNombreGuardar] = useState("");
  const [tipoGuardar, setTipoGuardar] = useState<number>(0);
  const [modoGuardar, setModoGuardar] = useState<"actualizar" | "nuevo">(
    "actualizar"
  );

  useEffect(() => {
    if (editor && modalGuardar) {
      setNombreGuardar(editor.nombre);
      setTipoGuardar(editor.tipoOficioId);
    }
  }, [modalGuardar, editor]);

  if (!editor || editor.minimizado) return null;

  const handleGuardar = async () => {
    if (!editor) return;
    setGuardando(modeloId, true);
    try {
      const res = await fetch(
        `/api/legales/modelos-oficio/${modeloId}/contenido`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            html: editor.contenidoHtml,
            nombre: modoGuardar === "nuevo" ? nombreGuardar.trim() : editor.nombre,
            tipoOficioId:
              modoGuardar === "nuevo" ? tipoGuardar : editor.tipoOficioId,
            guardarComo: modoGuardar === "nuevo",
          }),
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error((data?.error as string) || "Error al guardar");
      }
      marcarGuardado(modeloId);
      setModalGuardar(false);
      showMessage(
        "ok",
        modoGuardar === "nuevo"
          ? "Nuevo modelo creado correctamente."
          : "Modelo actualizado correctamente."
      );
      onModeloGuardado?.();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error inesperado";
      showMessage("error", msg);
    } finally {
      setGuardando(modeloId, false);
    }
  };

  const handleCerrar = () => {
    if (editor.modificado) {
      if (!confirm("Hay cambios sin guardar. ¿Cerrar de todas formas?")) return;
    }
    cerrarEditor(modeloId);
  };

  return (
    <>
      <div
        className="fixed inset-0 bg-black/20 z-40"
        onClick={() => minimizarEditor(modeloId)}
      />

      <div className="fixed inset-4 z-50 bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-gray-200">
        <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-200 flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 flex-shrink-0" />
            <span className="font-semibold text-gray-800 text-sm truncate">
              {editor.nombre}
            </span>
            <span className="text-xs text-gray-400 flex-shrink-0">
              {editor.tipoOficio}
            </span>
            {editor.modificado && (
              <span className="text-xs bg-amber-100 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full flex-shrink-0">
                ● Sin guardar
              </span>
            )}
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              onClick={() => setModalGuardar(true)}
              disabled={!editor.modificado}
              title="Guardar"
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {editor.guardando ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Save className="w-3.5 h-3.5" />
              )}
              Guardar
            </button>
            <button
              onClick={() => minimizarEditor(modeloId)}
              title="Minimizar"
              className="p-1.5 rounded-lg hover:bg-gray-200 transition-colors ml-1"
            >
              <Minimize2 className="w-4 h-4 text-gray-500" />
            </button>
            <button
              onClick={handleCerrar}
              title="Cerrar editor"
              className="p-1.5 rounded-lg hover:bg-red-50 hover:text-red-500 transition-colors"
            >
              <X className="w-4 h-4 text-gray-500" />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-1 px-4 py-1.5 border-b border-gray-100 bg-white flex-shrink-0 flex-wrap">
          {[
            { cmd: "bold", label: "N", cls: "font-bold" },
            { cmd: "italic", label: "I", cls: "italic" },
            { cmd: "underline", label: "S", cls: "underline" },
          ].map(({ cmd, label, cls }) => (
            <button
              key={cmd}
              onMouseDown={(e) => {
                e.preventDefault();
                document.execCommand(cmd);
              }}
              className={`w-7 h-7 text-sm rounded hover:bg-gray-100 transition-colors ${cls}`}
            >
              {label}
            </button>
          ))}
          <div className="w-px h-5 bg-gray-200 mx-1" />
          {[
            { cmd: "justifyLeft", label: "≡L" },
            { cmd: "justifyCenter", label: "≡C" },
            { cmd: "justifyRight", label: "≡R" },
            { cmd: "justifyFull", label: "≡J" },
          ].map(({ cmd, label }) => (
            <button
              key={cmd}
              onMouseDown={(e) => {
                e.preventDefault();
                document.execCommand(cmd);
              }}
              className="px-2 h-7 text-xs rounded hover:bg-gray-100 transition-colors"
            >
              {label}
            </button>
          ))}
          <div className="w-px h-5 bg-gray-200 mx-1" />
          <span className="text-xs text-gray-400">
            Seleccioná texto y usá Ctrl+C / Ctrl+V para copiar entre editores
          </span>
        </div>

        <div
          contentEditable
          suppressContentEditableWarning
          className="flex-1 overflow-y-auto p-8 focus:outline-none prose prose-sm max-w-none text-gray-800"
          style={{ minHeight: 0 }}
          dangerouslySetInnerHTML={{ __html: editor.contenidoHtml }}
          onInput={(e) =>
            actualizarContenido(
              modeloId,
              (e.target as HTMLDivElement).innerHTML
            )
          }
        />
      </div>

      {modalGuardar && (
        <div className="fixed inset-0 z-[60] bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm border">
            <div className="p-5 border-b">
              <h3 className="font-semibold text-gray-900">¿Cómo guardar?</h3>
            </div>
            <div className="p-5 space-y-3">
              <label className="flex items-start gap-3 cursor-pointer p-3 rounded-lg border-2 transition-colors hover:border-emerald-300 hover:bg-emerald-50"
                style={{
                  borderColor:
                    modoGuardar === "actualizar" ? "#059669" : "#e5e7eb",
                }}
              >
                <input
                  type="radio"
                  name="modoGuardar"
                  checked={modoGuardar === "actualizar"}
                  onChange={() => setModoGuardar("actualizar")}
                  className="mt-0.5 accent-emerald-600"
                />
                <div>
                  <p className="text-sm font-medium text-gray-800">
                    Actualizar este modelo
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Sobreescribe "{editor.nombre}"
                  </p>
                </div>
              </label>

              <label className="flex items-start gap-3 cursor-pointer p-3 rounded-lg border-2 transition-colors hover:border-emerald-300 hover:bg-emerald-50"
                style={{
                  borderColor:
                    modoGuardar === "nuevo" ? "#059669" : "#e5e7eb",
                }}
              >
                <input
                  type="radio"
                  name="modoGuardar"
                  checked={modoGuardar === "nuevo"}
                  onChange={() => setModoGuardar("nuevo")}
                  className="mt-0.5 accent-emerald-600"
                />
                <div>
                  <p className="text-sm font-medium text-gray-800">
                    Guardar como nuevo modelo
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Crea un modelo nuevo sin modificar el original
                  </p>
                </div>
              </label>

              {modoGuardar === "nuevo" && (
                <div className="space-y-3 pt-1">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Nombre del nuevo modelo <span className="text-red-500">*</span>
                    </label>
                    <input
                      autoFocus
                      value={nombreGuardar}
                      onChange={(e) => setNombreGuardar(e.target.value)}
                      className="w-full border border-emerald-500 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Tipo de oficio
                    </label>
                    <select
                      value={tipoGuardar}
                      onChange={(e) =>
                        setTipoGuardar(parseInt(e.target.value, 10))
                      }
                      className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300"
                    >
                      {tiposOficio.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.nombre}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 p-5 border-t bg-gray-50 rounded-b-xl">
              <button
                onClick={() => setModalGuardar(false)}
                className="px-4 py-2 text-sm rounded-lg border border-gray-300 hover:bg-gray-100 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleGuardar}
                disabled={
                  editor.guardando ||
                  (modoGuardar === "nuevo" && !nombreGuardar.trim())
                }
                className="px-4 py-2 text-sm rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors flex items-center gap-2"
              >
                {editor.guardando ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Guardando...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    Confirmar
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

