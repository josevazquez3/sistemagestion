export type SeccionLegislacion = "LEGISLACION" | "RESOLUCIONES_CS";

export type CategoriaLegislacion = {
  id: number;
  nombre: string;
  descripcion: string | null;
  activo: boolean;
  creadoEn: string;
  actualizadoEn: string;
  cantidadDocumentos?: number;
};

export type DocumentoLegislacion = {
  id: number;
  categoriaId: number | null;
  titulo: string;
  descripcion: string | null;
  nombreArchivo: string;
  urlArchivo: string;
  tipoArchivo: string;
  seccion: SeccionLegislacion;
  fechaDocumento: string | null;
  creadoEn: string;
  actualizadoEn: string;
  categoria?: { id: number; nombre: string } | null;
};
