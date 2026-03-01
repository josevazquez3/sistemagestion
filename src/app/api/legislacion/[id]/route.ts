import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { registrarAuditoria } from "@/lib/auditoria";
import { mkdir, unlink, writeFile } from "fs/promises";
import path from "path";
import { randomBytes } from "crypto";
import { SeccionLegislacion } from "@prisma/client";

const ROLES_WRITE = ["ADMIN", "SECRETARIA"] as const;
const MAX_FILE_SIZE = 20 * 1024 * 1024;
const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const PDF_MIME = "application/pdf";
const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "legislacion");

function canWrite(roles: string[]) {
  return ROLES_WRITE.some((r) => roles.includes(r));
}

function parseId(id: string): number | null {
  const n = parseInt(id, 10);
  return isNaN(n) ? null : n;
}

function parseFechaArgentina(str: string): Date | null {
  if (!str) return null;
  const parts = str.split("/").map((x) => parseInt(x, 10));
  if (parts.length !== 3) return null;
  const [d, m, y] = parts;
  const date = new Date(y, m - 1, d);
  if (isNaN(date.getTime())) return null;
  return date;
}

function validarSeccion(s: string): s is SeccionLegislacion {
  return s === "LEGISLACION" || s === "RESOLUCIONES_CS";
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const id = parseId((await params).id);
  if (id === null) return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  const doc = await prisma.documentoLegislacion.findUnique({
    where: { id },
    include: { categoria: { select: { id: true, nombre: true } } },
  });
  if (!doc) return NextResponse.json({ error: "Documento no encontrado" }, { status: 404 });
  return NextResponse.json(doc);
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const roles = (session?.user as { roles?: string[] })?.roles ?? [];
  if (!canWrite(roles)) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const id = parseId((await params).id);
  if (id === null) return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  const doc = await prisma.documentoLegislacion.findUnique({ where: { id } });
  if (!doc) return NextResponse.json({ error: "Documento no encontrado" }, { status: 404 });
  if (!req.headers.get("content-type")?.includes("multipart/form-data")) {
    return NextResponse.json({ error: "Se requiere multipart/form-data" }, { status: 400 });
  }
  try {
    const formData = await req.formData();
    const titulo = (formData.get("titulo") as string)?.trim();
    const descripcion = (formData.get("descripcion") as string)?.trim();
    const categoriaIdStr = (formData.get("categoriaId") as string)?.trim();
    const fechaDocumentoStr = (formData.get("fechaDocumento") as string)?.trim();
    const quitarArchivo = formData.get("quitarArchivo") === "true" || formData.get("quitarArchivo") === "1";
    const file = formData.get("file") as File | null;

    const data: Record<string, unknown> = {};
    if (titulo !== undefined) data.titulo = titulo;
    if (descripcion !== undefined) data.descripcion = descripcion?.trim() || null;
    if (categoriaIdStr === "" || categoriaIdStr === "todos") data.categoriaId = null;
    else if (categoriaIdStr) {
      const cid = parseInt(categoriaIdStr, 10);
      if (!isNaN(cid)) data.categoriaId = cid;
    }
    const fd = parseFechaArgentina(fechaDocumentoStr ?? "");
    if (fechaDocumentoStr !== undefined) data.fechaDocumento = fd ?? null;

    if (quitarArchivo && doc.urlArchivo) {
      try {
        await unlink(path.join(process.cwd(), "public", doc.urlArchivo));
      } catch {}
      if (!file || file.size === 0) {
        return NextResponse.json(
          { error: "Debe seleccionar un archivo para reemplazar al quitar el actual" },
          { status: 400 }
        );
      }
    }

    if (file && file.size > 0) {
      const name = file.name.toLowerCase();
      const isPdf = name.endsWith(".pdf");
      const isDocx = name.endsWith(".docx");
      if (!isPdf && !isDocx) {
        return NextResponse.json({ error: "Solo se permiten PDF o DOCX" }, { status: 400 });
      }
      if (file.size > MAX_FILE_SIZE) {
        return NextResponse.json({ error: "El archivo no puede superar 20 MB" }, { status: 400 });
      }
      if (doc.urlArchivo) {
        try {
          await unlink(path.join(process.cwd(), "public", doc.urlArchivo));
        } catch {}
      }
      await mkdir(UPLOAD_DIR, { recursive: true });
      const ext = isPdf ? "pdf" : "docx";
      const safeName = `leg_${Date.now()}_${randomBytes(4).toString("hex")}.${ext}`;
      const filePath = path.join(UPLOAD_DIR, safeName);
      await writeFile(filePath, Buffer.from(await file.arrayBuffer()));
      data.nombreArchivo = file.name;
      data.urlArchivo = `/uploads/legislacion/${safeName}`;
      data.tipoArchivo = isPdf ? "PDF" : "DOCX";
    }

    const updated = await prisma.documentoLegislacion.update({
      where: { id },
      data: data as Parameters<typeof prisma.documentoLegislacion.update>[0]["data"],
      include: { categoria: { select: { id: true, nombre: true } } },
    });

    const user = session?.user as { id?: string; name?: string; email?: string };
    await registrarAuditoria({
      userId: user?.id ?? "",
      userNombre: user?.name ?? "",
      userEmail: user?.email ?? "",
      accion: "Editó un documento de legislación",
      modulo: "Legislación",
      ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? undefined,
    });
    return NextResponse.json(updated);
  } catch (e) {
    console.error("Error actualizando documento:", e);
    return NextResponse.json({ error: "Error al actualizar el documento" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const roles = (session?.user as { roles?: string[] })?.roles ?? [];
  if (!canWrite(roles)) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const id = parseId((await params).id);
  if (id === null) return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  const doc = await prisma.documentoLegislacion.findUnique({ where: { id } });
  if (!doc) return NextResponse.json({ error: "Documento no encontrado" }, { status: 404 });
  if (doc.urlArchivo) {
    try {
      await unlink(path.join(process.cwd(), "public", doc.urlArchivo));
    } catch {}
  }
  await prisma.documentoLegislacion.delete({ where: { id } });
  const user = session?.user as { id?: string; name?: string; email?: string };
  await registrarAuditoria({
    userId: user?.id ?? "",
    userNombre: user?.name ?? "",
    userEmail: user?.email ?? "",
    accion: "Eliminó un documento de legislación",
    modulo: "Legislación",
    ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? undefined,
  });
  return NextResponse.json({ success: true });
}
