import { create } from "zustand";

export interface EditorNotaAbierto {
  modeloId: number;
  nombre: string;
  tipoNota: string;
  tipoNotaId: number;
  contenidoHtml: string;
  contenidoOriginal: string;
  minimizado: boolean;
  guardando: boolean;
  modificado: boolean;
  cargando: boolean;
}

interface EditoresDocxNotasStore {
  editores: EditorNotaAbierto[];
  abrirEditor: (datos: {
    modeloId: number;
    nombre: string;
    tipoNota: string;
    tipoNotaId: number;
    contenidoHtml: string;
  }) => void;
  minimizarEditor: (modeloId: number) => void;
  restaurarEditor: (modeloId: number) => void;
  cerrarEditor: (modeloId: number) => void;
  actualizarContenido: (modeloId: number, html: string) => void;
  setGuardando: (modeloId: number, valor: boolean) => void;
  marcarGuardado: (modeloId: number) => void;
}

const MAX_EDITORES = 3;

export const useEditoresDocxNotasStore = create<EditoresDocxNotasStore>((set, get) => ({
  editores: [],

  abrirEditor: (datos) => {
    const { editores } = get();
    const yaAbierto = editores.find((e) => e.modeloId === datos.modeloId);
    if (yaAbierto) {
      set({
        editores: editores.map((e) => ({
          ...e,
          minimizado: e.modeloId !== datos.modeloId,
        })),
      });
      return;
    }
    if (editores.length >= MAX_EDITORES) {
      alert(`Máximo ${MAX_EDITORES} editores abiertos. Cerrá uno antes de abrir otro.`);
      return;
    }
    set({
      editores: [
        ...editores.map((e) => ({ ...e, minimizado: true })),
        {
          ...datos,
          contenidoOriginal: datos.contenidoHtml,
          minimizado: false,
          guardando: false,
          modificado: false,
          cargando: false,
        },
      ],
    });
  },

  minimizarEditor: (modeloId) =>
    set((state) => ({
      editores: state.editores.map((e) =>
        e.modeloId === modeloId ? { ...e, minimizado: true } : e
      ),
    })),

  restaurarEditor: (modeloId) =>
    set((state) => ({
      editores: state.editores.map((e) => ({
        ...e,
        minimizado: e.modeloId !== modeloId,
      })),
    })),

  cerrarEditor: (modeloId) =>
    set((state) => ({
      editores: state.editores.filter((e) => e.modeloId !== modeloId),
    })),

  actualizarContenido: (modeloId, html) =>
    set((state) => ({
      editores: state.editores.map((e) =>
        e.modeloId === modeloId
          ? { ...e, contenidoHtml: html, modificado: html !== e.contenidoOriginal }
          : e
      ),
    })),

  setGuardando: (modeloId, valor) =>
    set((state) => ({
      editores: state.editores.map((e) =>
        e.modeloId === modeloId ? { ...e, guardando: valor } : e
      ),
    })),

  marcarGuardado: (modeloId) =>
    set((state) => ({
      editores: state.editores.map((e) =>
        e.modeloId === modeloId
          ? { ...e, modificado: false, contenidoOriginal: e.contenidoHtml }
          : e
      ),
    })),
}));

