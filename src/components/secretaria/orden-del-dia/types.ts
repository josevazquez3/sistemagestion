export type CategoriaOrdenDia = {
  id: number;
  nombre: string;
  descripcion: string | null;
  activo: boolean;
  creadoEn: string;
  actualizadoEn: string;
  cantidadDocumentos?: number;
};

export type DocumentoOrdenDia = {
  id: number;
  categoriaId: number | null;
  titulo: string;
  descripcion: string | null;
  nombreArchivo: string;
  urlArchivo: string;
  tipoArchivo: string;
  fechaDocumento: string | null;
  creadoEn: string;
  actualizadoEn: string;
  categoria?: { id: number; nombre: string } | null;
};
