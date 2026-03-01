export type TipoNota = {
  id: number;
  nombre: string;
  descripcion: string | null;
  activo: boolean;
  cantidadModelos: number;
};

export type ModeloNota = {
  id: number;
  tipoNotaId: number;
  nombre: string;
  nombreArchivo: string;
  urlArchivo: string;
  creadoEn: string;
  tipoNota: { id: number; nombre: string; activo: boolean };
};
