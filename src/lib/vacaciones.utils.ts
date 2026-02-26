/**
 * Utilidades de negocio para el Módulo de Vacaciones
 */

const MESES_ES: readonly string[] = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"
];

/**
 * Calcula días corridos entre dos fechas, ambos extremos inclusive.
 * @param desde - Fecha de inicio
 * @param hasta - Fecha de fin
 * @returns Cantidad de días (incluyendo desde y hasta)
 */
export function calcularDiasVacaciones(desde: Date, hasta: Date): number {
  const inicio = new Date(desde);
  const fin = new Date(hasta);

  inicio.setHours(0, 0, 0, 0);
  fin.setHours(0, 0, 0, 0);

  const diffMs = fin.getTime() - inicio.getTime();
  const diffDias = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDias < 0) {
    return 0;
  }

  return diffDias + 1;
}

/**
 * Convierte un número entero a palabras en español (rango 1–365).
 * Usado para el documento formal de solicitud de vacaciones.
 */
export function numeroALetras(n: number): string {
  if (n < 1 || n > 365) {
    return n.toString();
  }

  const unidades: readonly string[] = [
    "", "uno", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve"
  ];

  const especiales10_15: readonly string[] = [
    "diez", "once", "doce", "trece", "catorce", "quince"
  ];

  const dieci: readonly string[] = [
    "", "dieciséis", "diecisiete", "dieciocho", "diecinueve"
  ];

  const veinte: readonly string[] = [
    "veinte", "veintiuno", "veintidós", "veintitrés", "veinticuatro",
    "veinticinco", "veintiséis", "veintisiete", "veintiocho", "veintinueve"
  ];

  const decenas: readonly string[] = [
    "", "", "veinte", "treinta", "cuarenta", "cincuenta",
    "sesenta", "setenta", "ochenta", "noventa"
  ];

  const centenas: readonly string[] = [
    "", "ciento", "doscientos", "trescientos", "cuatrocientos",
    "quinientos", "seiscientos", "setecientos", "ochocientos", "novecientos"
  ];

  function convertirHasta99(num: number): string {
    if (num === 0) return "";
    if (num < 10) return unidades[num];
    if (num >= 10 && num <= 15) return especiales10_15[num - 10];
    if (num >= 16 && num <= 19) return dieci[num - 15];
    if (num >= 20 && num <= 29) return veinte[num - 20];

    const d = Math.floor(num / 10);
    const u = num % 10;
    if (u === 0) return decenas[d];
    return `${decenas[d]} y ${unidades[u]}`;
  }

  if (n === 100) return "cien";
  if (n < 100) return convertirHasta99(n);

  const c = Math.floor(n / 100);
  const resto = n % 100;

  if (resto === 0) {
    if (c === 1) return "cien";
    return centenas[c];
  }

  const parteCentena = c === 1 ? "ciento" : centenas[c];
  return `${parteCentena} ${convertirHasta99(resto)}`;
}

/**
 * Formatea una fecha como DD/MM/YYYY
 */
export function formatearFecha(fecha: Date): string {
  const d = new Date(fecha);
  const dia = d.getDate().toString().padStart(2, "0");
  const mes = (d.getMonth() + 1).toString().padStart(2, "0");
  const anio = d.getFullYear();
  return `${dia}/${mes}/${anio}`;
}

/**
 * Formatea una fecha como "DD de [mes en español] de YYYY"
 * Ejemplo: "22 de diciembre de 2026"
 */
export function formatearFechaLarga(fecha: Date): string {
  const d = new Date(fecha);
  const dia = d.getDate();
  const mes = MESES_ES[d.getMonth()];
  const anio = d.getFullYear();
  return `${dia} de ${mes} de ${anio}`;
}
