import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { registrarAuditoria } from "@/lib/auditoria";

const ROLES = ["ADMIN", "LEGALES"] as const;

function canAccess(roles: string[]) {
  return ROLES.some((r) => roles.includes(r));
}

/** GET - Listar tipos de oficio */
export async function GET() {
  const session = await auth();
  const roles = (session?.user as { roles?: string[] })?.roles ?? [];
  if (!canAccess(roles)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const tipos = await prisma.tipoOficio.findMany({
    orderBy: { nombre: "asc" },
    include: {
      _count: { select: { modelos: true } },
    },
  });

  return NextResponse.json({
    data: tipos.map((t) => ({
      id: t.id,
      nombre: t.nombre,
      descripcion: t.descripcion,
      activo: t.activo,
      creadoEn: t.creadoEn,
      actualizadoEn: t.actualizadoEn,
      cantidadModelos: t._count.modelos,
    })),
  });
}

/** POST - Crear tipo de oficio */
export async function POST(req: NextRequest) {
  const session = await auth();
  const roles = (session?.user as { roles?: string[] })?.roles ?? [];
  if (!canAccess(roles)) {
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

    const tipo = await prisma.tipoOficio.create({
      data: {
        nombre: nombre.trim(),
        descripcion: descripcion?.trim() || null,
      },
    });

    const user = session?.user as { id?: string; name?: string; email?: string };
    await registrarAuditoria({
      userId: user?.id ?? "",
      userNombre: user?.name ?? "",
      userEmail: user?.email ?? "",
      accion: "Creó un tipo de oficio",
      modulo: "Legales",
      ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? undefined,
    });

    return NextResponse.json(tipo);
  } catch (e) {
    console.error("Error creando tipo de oficio:", e);
    return NextResponse.json(
      { error: "Error al crear tipo de oficio" },
      { status: 500 }
    );
  }
}
