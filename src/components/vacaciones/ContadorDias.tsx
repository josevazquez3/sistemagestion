"use client";

interface ContadorDiasProps {
  diasSeleccionados: number;
  diasDisponibles: number;
  diasRestarian: number;
  /** Si true, muestra en rojo y se usa para deshabilitar Guardar */
  insuficientes: boolean;
}

export function ContadorDias({
  diasSeleccionados,
  diasDisponibles,
  diasRestarian,
  insuficientes,
}: ContadorDiasProps) {
  return (
    <div
      className={`rounded-lg border px-4 py-2 text-sm font-medium ${
        insuficientes
          ? "border-red-300 bg-red-50 text-red-700"
          : "border-gray-200 bg-gray-50 text-gray-700"
      }`}
    >
      <span>Días seleccionados: {diasSeleccionados}</span>
      <span className="mx-2">|</span>
      <span>Disponibles: {diasDisponibles}</span>
      <span className="mx-2">|</span>
      <span>Restarían: {diasRestarian}</span>
    </div>
  );
}
