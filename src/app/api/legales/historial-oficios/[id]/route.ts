import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { registrarAuditoria } from "@/lib/auditoria";
import { writeFile, mkdir, unlink } from "fs/promises";
import path from "path";
import { randomBytes } from "crypto";

const ROLES = ["ADMIN", "LEGALES"] as const;
const PDF_MIME = "application/pdf";
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "historial-oficios");

function canAccess(roles: string[]) {
  return ROLES.some((r) => roles.includes(r));
}

function parseId(id: string): number | null {
  const n = parseInt(id, 10);
  return isNaN(n) ? null : n;
}

function parseFechaArgentina(str: string): Date | null {
  if (!str) return null;
  const [d, m, y] = str.split("/").map((x) => parseInt(x, 10));
  if (!d || !m || !y) return null;
  const date = new Date(y, m - 1, d);
  if (isNaN(date.getTime())) return null;
  return date;
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
    const fechaOficio = parseFechaArgentina(fechaOficioStr ?? "");
    if (fechaOficio) data.fechaOficio = fechaOficio;
    if (quitarArchivo && oficio.urlArchivo) {
      try { await unlink(path.join(process.cwd(), "public", oficio.urlArchivo)); } catch {}
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
        try { await unlink(path.join(process.cwd(), "public", oficio.urlArchivo)); } catch {}
      }
      await mkdir(UPLOAD_DIR, { recursive: true });
      const safeName = `oficio_${Date.now()}_${randomBytes(4).toString("hex")}.pdf`;
      const filePath = path.join(UPLOAD_DIR, safeName);
      await writeFile(filePath, Buffer.from(await file.arrayBuffer()));
      data.nombreArchivo = file.name;
      data.urlArchivo = `/uploads/historial-oficios/${safeName}`;
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
    try { await unlink(path.join(process.cwd(), "public", oficio.urlArchivo)); } catch {}
  }
  await prisma.oficioRespondido.delete({ where: { id } });
  const user = session?.user as { id?: string; name?: string; email?: string };
  await registrarAuditoria({
    userId: user?.id ?? "", userNombre: user?.name ?? "", userEmail: user?.email ?? "",
    accion: "Eliminó un oficio respondido", modulo: "Legales", ip: undefined,
  });
  return NextResponse.json({ success: true });
}
