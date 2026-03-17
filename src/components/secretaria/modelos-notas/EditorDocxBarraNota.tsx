'use client';

import { X, FileText } from "lucide-react";
import { useEditoresDocxNotasStore } from "@/lib/stores/editoresDocxNotasStore";

export function EditorDocxBarraNota() {
  const { editores, restaurarEditor, cerrarEditor } = useEditoresDocxNotasStore();
  const minimizados = editores.filter((e) => e.minimizado);

  if (minimizados.length === 0) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 pointer-events-none">
      <div className="flex items-end gap-1 px-6 pb-0 pointer-events-auto">
        {minimizados.map((editor) => (
          <div
            key={editor.modeloId}
            onClick={() => restaurarEditor(editor.modeloId)}
            title={`Restaurar: ${editor.nombre}`}
            className="flex items-center gap-2 bg-white border border-gray-200 border-b-0 rounded-t-lg px-3 py-2 shadow-lg cursor-pointer hover:bg-gray-50 transition-colors max-w-[220px] group"
          >
            <FileText className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
            <span className="text-xs font-medium text-gray-700 truncate">
              {editor.nombre}
            </span>
            {editor.modificado && (
              <span
                title="Cambios sin guardar"
                className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0"
              />
            )}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (editor.modificado) {
                  if (!confirm("Hay cambios sin guardar. ¿Cerrar?")) return;
                }
                cerrarEditor(editor.modeloId);
              }}
              className="p-0.5 rounded hover:bg-gray-200 flex-shrink-0 ml-1 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <X className="w-3 h-3 text-gray-500" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

