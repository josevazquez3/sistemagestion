export type EstadoReunion = "PENDIENTE" | "FINALIZADA";

export type Reunion = {
  id: number;
  fechaCarga: string;
  organismo: string;
  fechaReunion: string;
  hora: string | null;
  observacion: string | null;
  estado: EstadoReunion;
  contactoNombre: string | null;
  contactoApellido: string | null;
  contactoCargo: string | null;
  contactoTelefono: string | null;
  contactoMail: string | null;
  creadoEn: string;
  actualizadoEn: string;
};
