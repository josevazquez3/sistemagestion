import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { registrarAuditoria } from "@/lib/auditoria";
import { subirArchivo, eliminarArchivo } from "@/lib/blob";
import path from "path";
import { randomBytes } from "crypto";
import { unlink } from "fs/promises";
import { parsearFechaSegura } from "@/lib/utils/fecha";

const ROLES = ["ADMIN", "LEGALES"] as const;
const PDF_MIME = "application/pdf";
const MAX_FILE_SIZE = 10 * 1024 * 1024;
function canAccess(roles: string[]) {
  return ROLES.some((r) => roles.includes(r));
}

function parseId(id: string): number | null {
  const n = parseInt(id, 10);
  return isNaN(n) ? null : n;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const roles = (session?.user as { roles?: string[] })?.roles ?? [];
  if (!canAccess(roles)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }
  const id = parseId((await params).id);
  if (id === null) return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  const oficio = await prisma.oficioRespondido.findUnique({ where: { id } });
  if (!oficio) return NextResponse.json({ error: "Oficio no encontrado" }, { status: 404 });
  return NextResponse.json(oficio);
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const roles = (session?.user as { roles?: string[] })?.roles ?? [];
  if (!canAccess(roles)) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const id = parseId((await params).id);
  if (id === null) return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  const oficio = await prisma.oficioRespondido.findUnique({ where: { id } });
  if (!oficio) return NextResponse.json({ error: "Oficio no encontrado" }, { status: 404 });
  const contentType = req.headers.get("content-type") ?? "";
  if (!contentType.includes("multipart/form-data")) {
    return NextResponse.json({ error: "Se requiere multipart/form-data" }, { status: 400 });
  }
  try {
    const formData = await req.formData();
    const titulo = (formData.get("titulo") as string)?.trim();
    const fechaOficioStr = (formData.get("fechaOficio") as string)?.trim();
    const quitarArchivo = formData.get("quitarArchivo") === "true" || formData.get("quitarArchivo") === "1";
    const file = formData.get("file") as File | null;
    const data: { titulo?: string; fechaOficio?: Date; nombreArchivo?: string | null; urlArchivo?: string | null } = {};
    if (titulo !== undefined) data.titulo = titulo;
    const fechaOficio = parsearFechaSegura(fechaOficioStr ?? "");
    if (fechaOficio) data.fechaOficio = fechaOficio;
    if (quitarArchivo && oficio.urlArchivo) {
      await eliminarArchivo(oficio.urlArchivo);
      if (oficio.urlArchivo.startsWith("/")) {
        try { await unlink(path.join(process.cwd(), "public", oficio.urlArchivo)); } catch {}
      }
      data.nombreArchivo = null;
      data.urlArchivo = null;
    }
    if (file && file.size > 0) {
      const name = file.name.toLowerCase();
      if (!name.endsWith(".pdf")) {
        return NextResponse.json(
          { error: "Solo se permiten archivos PDF" },
          { status: 400 }
        );
      }
      const contentType = file.type?.toLowerCase() ?? "";
      const validMime =
        contentType === PDF_MIME ||
        contentType === "application/octet-stream" ||
        contentType === "";
      if (!validMime) {
        return NextResponse.json(
          { error: "Tipo de archivo no válido. Debe ser PDF" },
          { status: 400 }
        );
      }
      if (file.size > MAX_FILE_SIZE) {
        return NextResponse.json(
          { error: "El archivo no puede superar 10 MB" },
          { status: 400 }
        );
      }
      if (oficio.urlArchivo) {
        await eliminarArchivo(oficio.urlArchivo);
        if (oficio.urlArchivo.startsWith("/")) {
          try { await unlink(path.join(process.cwd(), "public", oficio.urlArchivo)); } catch {}
        }
      }
      const safeName = `oficio_${Date.now()}_${randomBytes(4).toString("hex")}.pdf`;
      const mime = file.type || PDF_MIME;
      data.urlArchivo = await subirArchivo("historial-oficios", safeName, file, mime);
      data.nombreArchivo = file.name;
    }
    const updated = await prisma.oficioRespondido.update({ where: { id }, data });
    const user = session?.user as { id?: string; name?: string; email?: string };
    await registrarAuditoria({
      userId: user?.id ?? "", userNombre: user?.name ?? "", userEmail: user?.email ?? "",
      accion: "Editó un oficio respondido", modulo: "Legales",
      ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? undefined,
    });
    return NextResponse.json(updated);
  } catch (e) {
    console.error("Error actualizando oficio:", e);
    return NextResponse.json({ error: "Error al actualizar el oficio" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const roles = (session?.user as { roles?: string[] })?.roles ?? [];
  if (!canAccess(roles)) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const id = parseId((await params).id);
  if (id === null) return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  const oficio = await prisma.oficioRespondido.findUnique({ where: { id } });
  if (!oficio) return NextResponse.json({ error: "Oficio no encontrado" }, { status: 404 });
  if (oficio.urlArchivo) {
    await eliminarArchivo(oficio.urlArchivo);
    if (oficio.urlArchivo.startsWith("/")) {
      try { await unlink(path.join(process.cwd(), "public", oficio.urlArchivo)); } catch {}
    }
  }
  await prisma.oficioRespondido.delete({ where: { id } });
  const user = session?.user as { id?: string; name?: string; email?: string };
  await registrarAuditoria({
    userId: user?.id ?? "", userNombre: user?.name ?? "", userEmail: user?.email ?? "",
    accion: "Eliminó un oficio respondido", modulo: "Legales", ip: undefined,
  });
  return NextResponse.json({ success: true });
}
