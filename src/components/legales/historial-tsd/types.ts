/** Props serializadas desde RSC (fechas en ISO string). */
export type HistorialTsdRow = {
  id: number;
  titulo: string;
  fechaOficio: string;
  archivoNombre: string | null;
  archivoUrl: string | null;
  archivoKey: string | null;
  fechaCarga: string;
  actualizadoEn: string;
};
