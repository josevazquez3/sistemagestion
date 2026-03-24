export interface MayorCuenta {
  id: number;
  nombre: string;
  orden: number;
  createdAt: string;
}

export interface MayorMovimiento {
  id: number;
  cuentaId: number;
  cuentaNombre: string;
  fecha: string | null;
  concepto: string;
  importe: number;
  origen: string;
  origenId: number | null;
  createdAt: string;
}

export interface MayorRegla {
  id: number;
  palabra: string;
  cuentaId: number;
  cuentaNombre: string;
  createdAt: string;
}
