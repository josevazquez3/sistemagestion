import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const ROLES_LICENCIAS = ["ADMIN", "RRHH"] as const;

function canManageLicencias(roles: string[]) {
  return ROLES_LICENCIAS.some((r) => roles.includes(r));
}

/** GET - Listar observaciones de nómina de una licencia (más reciente primero) */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const roles = (session?.user as { roles?: string[] })?.roles ?? [];
  if (!canManageLicencias(roles)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const id = parseInt((await params).id, 10);
  if (isNaN(id)) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

  const licencia = await prisma.licencia.findUnique({
    where: { id },
    include: { observacionesNomina: { orderBy: { actualizadoEn: "desc" } } },
  });
  if (!licencia) return NextResponse.json({ error: "Licencia no encontrada" }, { status: 404 });

  return NextResponse.json({ data: licencia.observacionesNomina });
}

/** POST - Crear observación de nómina para una licencia */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const roles = (session?.user as { roles?: string[] })?.roles ?? [];
  if (!canManageLicencias(roles)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const id = parseInt((await params).id, 10);
  if (isNaN(id)) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

  const licencia = await prisma.licencia.findUnique({ where: { id } });
  if (!licencia) return NextResponse.json({ error: "Licencia no encontrada" }, { status: 404 });

  const body = await req.json();
  const texto = typeof body.texto === "string" ? body.texto.trim() : "";

  const obs = await prisma.observacionLicencia.create({
    data: { licenciaId: id, texto: texto || "" },
  });
  return NextResponse.json(obs);
}
