import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const ROLES = ["SUPER_ADMIN", "ADMIN", "TESORERO"] as const;

function canAccess(roles: string[]) {
  return ROLES.some((r) => roles.includes(r));
}

type CheckItem = { proveedor: string; cuit: string };

function normText(v: string | null | undefined) {
  return String(v ?? "").trim().toLowerCase();
}

function normCuit(v: string | null | undefined) {
  return String(v ?? "").trim();
}

export async function POST(req: NextRequest) {
  const session = await auth();
  const roles = (session?.user as { roles?: string[] })?.roles ?? [];
  if (!canAccess(roles)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const proveedores = Array.isArray(body?.proveedores) ? (body.proveedores as CheckItem[]) : [];

    const existentes = await prisma.proveedor.findMany({
      select: { proveedor: true, cuit: true },
    });

    const existentesNombre = new Set(existentes.map((e) => normText(e.proveedor)).filter(Boolean));
    const existentesCuit = new Set(existentes.map((e) => normCuit(e.cuit)).filter(Boolean));

    const resultados = proveedores.map((item) => {
      const nombre = normText(item?.proveedor);
      const cuit = normCuit(item?.cuit);
      const dupNombre = !!nombre && existentesNombre.has(nombre);
      const dupCuit = !!cuit && existentesCuit.has(cuit);

      let motivo: string | null = null;
      if (dupNombre && dupCuit) motivo = "Nombre y CUIT duplicados";
      else if (dupNombre) motivo = "Nombre duplicado";
      else if (dupCuit) motivo = "CUIT duplicado";

      return { isDuplicate: dupNombre || dupCuit, motivo };
    });

    return NextResponse.json(resultados);
  } catch {
    return NextResponse.json({ error: "Error al verificar duplicados." }, { status: 500 });
  }
}
