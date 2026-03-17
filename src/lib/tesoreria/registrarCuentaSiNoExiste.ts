import { prisma } from "@/lib/prisma";

/**
 * Asegura que exista una fila en CuentaBancaria que cubra este codOperativo
 * (por tokens en codOperativo o por codigo === token). Crea o fusiona.
 */
export async function registrarCuentaSiNoExiste(
  codOperativo: string,
  nombreSugerido?: string | null
): Promise<{ id: number; codigo: string; nombre: string } | null> {
  const cod = codOperativo?.trim();
  if (!cod) return null;

  const todas = await prisma.cuentaBancaria.findMany({
    where: { activo: true },
  });

  for (const c of todas) {
    const tokens = (c.codOperativo ?? "")
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    if (tokens.includes(cod)) {
      return { id: c.id, codigo: c.codigo, nombre: c.nombre };
    }
  }

  const porCodigoIgualOp = await prisma.cuentaBancaria.findUnique({
    where: { codigo: cod },
  });
  if (porCodigoIgualOp) {
    const set = new Set(
      (porCodigoIgualOp.codOperativo ?? "").trim().split(/\s+/).filter(Boolean)
    );
    set.add(cod);
    await prisma.cuentaBancaria.update({
      where: { codigo: cod },
      data: { codOperativo: Array.from(set).join(" ") },
    });
    return {
      id: porCodigoIgualOp.id,
      codigo: porCodigoIgualOp.codigo,
      nombre: porCodigoIgualOp.nombre,
    };
  }

  const nombreBase =
    nombreSugerido?.trim() && nombreSugerido.trim().length >= 2
      ? nombreSugerido.trim()
      : `Cuenta ${cod}`;

  try {
    const nueva = await prisma.cuentaBancaria.create({
      data: {
        codigo: cod,
        codOperativo: cod,
        nombre: nombreBase,
        activo: true,
      },
    });
    return { id: nueva.id, codigo: nueva.codigo, nombre: nueva.nombre };
  } catch (e: unknown) {
    const code = (e as { code?: string })?.code;
    if (code === "P2002") {
      return registrarCuentaSiNoExiste(cod, nombreSugerido);
    }
    throw e;
  }
}
