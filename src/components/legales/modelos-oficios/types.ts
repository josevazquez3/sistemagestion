export type TipoOficio = {
  id: number;
  nombre: string;
  descripcion: string | null;
  activo: boolean;
  cantidadModelos: number;
};

export type ModeloOficio = {
  id: number;
  tipoOficioId: number;
  nombre: string;
  nombreArchivo: string;
  urlArchivo: string;
  creadoEn: string;
  tipoOficio: { id: number; nombre: string; activo: boolean };
};
