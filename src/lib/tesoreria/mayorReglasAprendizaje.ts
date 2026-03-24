import { prisma } from "@/lib/prisma";
import { ensureMayorTables } from "./mayorRawQueries";
import {
  extraerPalabrasSignificativasConcepto,
  normalizarTextoMayor,
} from "./mayorReglasTexto";

/**
 * Tras asignar un movimiento EXTRACTO / FONDO_FIJO, crea reglas para las primeras
 * palabras significativas si aún no existen. No pisa reglas con otra cuenta.
 */
export async function aprenderReglasMayorDesdeConcepto(
  concepto: string,
  cuentaId: number
): Promise<void> {
  await ensureMayorTables();
  const candidatas = extraerPalabrasSignificativasConcepto(concepto, 3);
  for (const raw of candidatas) {
    const palabra = normalizarTextoMayor(raw);
    if (palabra.length < 2) continue;
    const exist = await prisma.mayorRegla.findUnique({
      where: { palabra },
    });
    if (!exist) {
      await prisma.mayorRegla.create({
        data: { palabra, cuentaId },
      });
    }
  }
}
