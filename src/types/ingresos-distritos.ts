export interface IngresoDistrito {
  id: number;
  mes: number;
  anio: number;
  codigos: string[];
  fecha: string;
  recibo: string | null;
  distrito: string | null;
  concepto: string;
  ctaColeg: number | null;
  nMatriculados: number | null;
  importe: number;
  saldo: number;
  extractoBancoId?: number | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface IngresoDistritoFormData {
  recibo: string;
  distrito: string;
  ctaColeg: string;
  nMatriculados: string;
}
