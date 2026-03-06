import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { registrarAuditoria } from "@/lib/auditoria";
import { EstadoReunion } from "@prisma/client";

const ROLES = ["ADMIN", "SECRETARIA", "SUPER_ADMIN"] as const;

function canAccess(roles: unknown): boolean {
  const list = Array.isArray(roles) ? roles : [];
  const names = list.map((r: unknown) =>
    typeof r === "string" ? r : (r as { nombre?: string })?.nombre ?? (r as { name?: string })?.name
  ).filter(Boolean) as string[];
  return ROLES.some((r) => names.includes(r));
}

function parseId(id: string): number | null {
  const n = parseInt(id, 10);
  return isNaN(n) ? null : n;
}

function parseFechaArgentina(str: string): Date | null {
  if (!str?.trim()) return null;
  const parts = str.trim().split("/").map((x) => parseInt(x, 10));
  if (parts.length !== 3) return null;
  const [d, m, y] = parts;
  if (!d || !m || !y) return null;
  const date = new Date(y, m - 1, d);
  return isNaN(date.getTime()) ? null : date;
}

/** GET - Obtener una reunión */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || !canAccess((session?.user as { roles?: unknown })?.roles ?? [])) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }
  const id = parseId((await params).id);
  if (id === null) return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  const reunion = await prisma.reunion.findUnique({ where: { id } });
  if (!reunion) return NextResponse.json({ error: "Reunión no encontrada" }, { status: 404 });
  return NextResponse.json(reunion);
}

/** PUT - Actualizar reunión */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const roles = (session?.user as { roles?: unknown })?.roles ?? [];
  if (!canAccess(roles)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }
  const id = parseId((await params).id);
  if (id === null) return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  const existente = await prisma.reunion.findUnique({ where: { id } });
  if (!existente) return NextResponse.json({ error: "Reunión no encontrada" }, { status: 404 });

  try {
    const body = await req.json();
    const organismo = body.organismo?.trim();
    const fechaReunionStr = body.fechaReunion?.trim();
    const fechaReunion = parseFechaArgentina(fechaReunionStr ?? "");
    if (organismo !== undefined && !organismo) {
      return NextResponse.json({ error: "Organismo / Institución es obligatorio" }, { status: 400 });
    }
    if (fechaReunionStr !== undefined && fechaReunionStr !== "" && !fechaReunion) {
      return NextResponse.json({ error: "Fecha de la reunión inválida (DD/MM/YYYY)" }, { status: 400 });
    }

    const data: Record<string, unknown> = {};
    if (body.organismo !== undefined) data.organismo = body.organismo?.trim() || existente.organismo;
    if (body.fechaReunion !== undefined) data.fechaReunion = fechaReunion ?? existente.fechaReunion;
    if (body.hora !== undefined) data.hora = body.hora?.trim() || null;
    if (body.observacion !== undefined) data.observacion = body.observacion?.trim() || null;
    if (body.contactoNombre !== undefined) data.contactoNombre = body.contactoNombre?.trim() || null;
    if (body.contactoApellido !== undefined) data.contactoApellido = body.contactoApellido?.trim() || null;
    if (body.contactoCargo !== undefined) data.contactoCargo = body.contactoCargo?.trim() || null;
    if (body.contactoTelefono !== undefined) data.contactoTelefono = body.contactoTelefono?.trim() || null;
    if (body.contactoMail !== undefined) data.contactoMail = body.contactoMail?.trim() || null;
    if (body.estado === "PENDIENTE" || body.estado === "FINALIZADA") data.estado = body.estado;

    const reunion = await prisma.reunion.update({
      where: { id },
      data: data as Parameters<typeof prisma.reunion.update>[0]["data"],
    });

    const user = session?.user as { id?: string; name?: string; email?: string };
    const soloEstado =
      Object.keys(data).length === 1 && "estado" in data;
    const accion = soloEstado
      ? (data.estado === EstadoReunion.FINALIZADA
          ? "Marcó reunión como finalizada"
          : "Marcó reunión como pendiente")
      : "Editó una reunión en la agenda";
    await registrarAuditoria({
      userId: user?.id ?? "",
      userNombre: user?.name ?? "",
      userEmail: user?.email ?? "",
      accion,
      modulo: "Secretaría",
      ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? undefined,
    });

    return NextResponse.json(reunion);
  } catch (e) {
    console.error("Error actualizando reunión:", e);
    return NextResponse.json({ error: "Error al actualizar" }, { status: 500 });
  }
}

/** DELETE - Eliminar reunión */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const roles = (session?.user as { roles?: unknown })?.roles ?? [];
  if (!canAccess(roles)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }
  const id = parseId((await params).id);
  if (id === null) return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  const existente = await prisma.reunion.findUnique({ where: { id } });
  if (!existente) return NextResponse.json({ error: "Reunión no encontrada" }, { status: 404 });

  await prisma.reunion.delete({ where: { id } });

  const user = session?.user as { id?: string; name?: string; email?: string };
  await registrarAuditoria({
    userId: user?.id ?? "",
    userNombre: user?.name ?? "",
    userEmail: user?.email ?? "",
    accion: "Eliminó una reunión de la agenda",
    modulo: "Secretaría",
    ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? undefined,
  });

  return NextResponse.json({ success: true });
}
