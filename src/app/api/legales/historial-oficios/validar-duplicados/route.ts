import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const ROLES = ["ADMIN", "LEGALES"] as const;

function canAccess(roles: string[]) {
  return ROLES.some((r) => roles.includes(r));
}

/**
 * GET - Validar duplicados por nombre de archivo (Historial de Oficios Respondidos).
 * Query: nombres=archivo1.pdf,archivo2.pdf
 * No valida extensión; solo compara nombres para detectar duplicados.
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  const roles = (session?.user as { roles?: string[] })?.roles ?? [];
  if (!canAccess(roles)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const nombresParam = searchParams.get("nombres");
  if (!nombresParam || !nombresParam.trim()) {
    return NextResponse.json(
      { error: "Falta el parámetro nombres (lista separada por comas)" },
      { status: 400 }
    );
  }

  const nombreArchivos = nombresParam
    .split(",")
    .map((n) => n.trim())
    .filter(Boolean);

  if (nombreArchivos.length === 0) {
    return NextResponse.json({
      duplicados: [],
      nuevos: [],
    });
  }

  const existentes = await prisma.oficioRespondido.findMany({
    where: { nombreArchivo: { in: nombreArchivos } },
    select: { id: true, nombreArchivo: true },
  });

  const setDuplicados = new Set(
    existentes
      .map((e) => e.nombreArchivo)
      .filter((n): n is string => n != null)
  );
  const duplicados = existentes
    .filter((e) => e.nombreArchivo != null)
    .map((e) => ({ nombreArchivo: e.nombreArchivo!, id: e.id }));
  const nuevos = nombreArchivos.filter((n) => !setDuplicados.has(n));

  return NextResponse.json({ duplicados, nuevos });
}
