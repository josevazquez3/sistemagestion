import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

const ROLES_WRITE = ["ADMIN", "SECRETARIA", "SUPER_ADMIN"] as const;

function canWrite(roles: unknown): boolean {
  const list = Array.isArray(roles) ? roles : [];
  const names = list.map((r: unknown) =>
    typeof r === "string" ? r : (r as { nombre?: string })?.nombre ?? (r as { name?: string })?.name
  ).filter(Boolean) as string[];
  return ROLES_WRITE.some((r) => names.includes(r));
}

const SECCIONES_VALIDAS = ["LEGISLACION", "RESOLUCIONES_CS"] as const;

/**
 * GET - Validar duplicados por nombre de archivo (opcionalmente por sección).
 * Query: nombres=archivo1.pdf,archivo2.docx  y opcional  seccion=RESOLUCIONES_CS
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  const roles = (session?.user as { roles?: unknown })?.roles ?? [];
  if (!canWrite(roles)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const nombresParam = searchParams.get("nombres");
  const seccionParam = searchParams.get("seccion")?.trim();
  if (!nombresParam?.trim()) {
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
    return NextResponse.json({ duplicados: [], nuevos: [] });
  }

  const where: Prisma.DocumentoLegislacionWhereInput = {
    nombreArchivo: { in: nombreArchivos },
  };
  if (seccionParam && SECCIONES_VALIDAS.includes(seccionParam as (typeof SECCIONES_VALIDAS)[number])) {
    where.seccion = seccionParam as Prisma.EnumSeccionLegislacionFilter["equals"];
  }

  const existentes = await prisma.documentoLegislacion.findMany({
    where,
    select: { id: true, nombreArchivo: true },
  });

  const setDuplicados = new Set(existentes.map((e) => e.nombreArchivo));
  const duplicados = existentes.map((e) => ({
    nombreArchivo: e.nombreArchivo,
    id: e.id,
  }));
  const nuevos = nombreArchivos.filter((n) => !setDuplicados.has(n));

  return NextResponse.json({ duplicados, nuevos });
}
