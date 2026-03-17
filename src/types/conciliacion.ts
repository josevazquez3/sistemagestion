export type TipoCuenta = "INGRESO" | "SALIDA" | "GASTO";

/** Lista del modal: cuentaCodigo = clave que coincide con movimiento.codOperativo */
export interface CuentaOperativa {
  cuentaCodigo: string;
  codigo: string;
  codOperativo: string;
  nombre: string;
}

export interface AsignacionCuenta {
  id?: number;
  cuentaCodigo: string;
  codOperativo?: string | null;
  cuentaNombre: string;
  tipo: TipoCuenta;
  orden: number;
}

export interface ConciliacionBanco {
  id: number;
  mes: number;
  anio: number;
  saldoAnterior: number;
  totalIngresos: number;
  totalSalidas: number;
  totalGastos: number;
  subtotal: number;
  totalConciliado: number;
  cerrado: boolean;
  asignaciones: AsignacionCuenta[];
}

export interface FilaConciliacion {
  id: number;
  fecha: string;
  concepto: string;
  cuentaCodigo: string;
  cuentaNombre: string;
  tipo: TipoCuenta;
  monto: number;
}

export interface ResumenConciliacion {
  saldoAnterior: number;
  totalIngresos: number;
  totalSalidas: number;
  totalGastos: number;
  subtotal: number;
  totalConciliado: number;
}
