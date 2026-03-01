import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const ROLES_WRITE = ["ADMIN", "SECRETARIA"] as const;

function canWrite(roles: string[]) {
  return ROLES_WRITE.some((r) => roles.includes(r));
}

/** GET - Listar categorías (todas o solo activas según query) */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const soloActivas = searchParams.get("activas") === "true";

  const where = soloActivas ? { activo: true } : {};

  const categorias = await prisma.categoriaLegislacion.findMany({
    where,
    orderBy: { nombre: "asc" },
    include: {
      _count: { select: { documentos: true } },
    },
  });

  return NextResponse.json({
    data: categorias.map((c) => ({
      id: c.id,
      nombre: c.nombre,
      descripcion: c.descripcion,
      activo: c.activo,
      creadoEn: c.creadoEn,
      actualizadoEn: c.actualizadoEn,
      cantidadDocumentos: c._count.documentos,
    })),
  });
}

/** POST - Crear categoría (solo Admin y Secretaria) */
export async function POST(req: NextRequest) {
  const session = await auth();
  const roles = (session?.user as { roles?: string[] })?.roles ?? [];
  if (!canWrite(roles)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { nombre, descripcion } = body;

    if (!nombre || typeof nombre !== "string" || !nombre.trim()) {
      return NextResponse.json(
        { error: "El nombre es obligatorio" },
        { status: 400 }
      );
    }

    const categoria = await prisma.categoriaLegislacion.create({
      data: {
        nombre: nombre.trim(),
        descripcion: descripcion?.trim() || null,
      },
    });

    return NextResponse.json(categoria);
  } catch (e) {
    console.error("Error creando categoría:", e);
    return NextResponse.json(
      { error: "Error al crear la categoría" },
      { status: 500 }
    );
  }
}
