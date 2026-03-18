import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { registrarAuditoria } from "@/lib/auditoria";
import { subirArchivo, eliminarArchivo } from "@/lib/blob";
import path from "path";
import { randomBytes } from "crypto";
import { unlink } from "fs/promises";
import { parsearFechaSegura } from "@/lib/utils/fecha";
import {
  validarArchivoWordModelo,
  contentTypeWordSubida,
  generarNombreAlmacenamientoModeloWord,
  MIME_WORD_DOC,
} from "@/lib/legales/modelosOficioArchivo";

const ROLES_WRITE = ["ADMIN", "SECRETARIA", "SUPER_ADMIN"] as const;
const MAX_FILE_SIZE = 20 * 1024 * 1024;
const PDF_MIME = "application/pdf";
const DOC_MIME = MIME_WORD_DOC;
function normalizeRole(r: unknown): string | null {
  if (typeof r === "string") return r;
  if (r && typeof r === "object" && "nombre" in r && typeof (r as { nombre: unknown }).nombre === "string")
    return (r as { nombre: string }).nombre;
  if (r && typeof r === "object" && "name" in r && typeof (r as { name: unknown }).name === "string")
    return (r as { name: string }).name;
  return null;
}

function canWrite(roles: unknown): boolean {
  const list = Array.isArray(roles) ? roles : [];
  const names = list.map(normalizeRole).filter(Boolean) as string[];
  return ROLES_WRITE.some((r) => names.includes(r));
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
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const id = parseId((await params).id);
  if (id === null) return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  const doc = await prisma.documentoOrdenDia.findUnique({
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
  const roles = (session?.user as { roles?: unknown })?.roles ?? [];
  if (!canWrite(roles)) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const id = parseId((await params).id);
  if (id === null) return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  const doc = await prisma.documentoOrdenDia.findUnique({ where: { id } });
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
    const fd = parsearFechaSegura(fechaDocumentoStr ?? "");
    if (fechaDocumentoStr !== undefined) data.fechaDocumento = fd ?? null;

    if (quitarArchivo && doc.urlArchivo) {
      await eliminarArchivo(doc.urlArchivo);
      if (doc.urlArchivo.startsWith("/")) {
        try { await unlink(path.join(process.cwd(), "public", doc.urlArchivo)); } catch {}
      }
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
      const isDoc = name.endsWith(".doc") && !name.endsWith(".docx");
      const isDocx = name.endsWith(".docx");
      if (!isPdf && !isDoc && !isDocx) {
        return NextResponse.json({ error: "Solo se permiten PDF, DOC o DOCX" }, { status: 400 });
      }
      if (isPdf) {
        const ct = file.type?.toLowerCase() ?? "";
        const okMime =
          ct === PDF_MIME || ct === "application/octet-stream" || ct === "";
        if (!okMime) {
          return NextResponse.json({ error: "Tipo de archivo no válido. Debe ser PDF" }, { status: 400 });
        }
      } else {
        const wordVal = validarArchivoWordModelo(file, MAX_FILE_SIZE);
        if (!wordVal.ok) return NextResponse.json({ error: wordVal.error }, { status: 400 });
      }
      if (file.size > MAX_FILE_SIZE) {
        return NextResponse.json({ error: "El archivo no puede superar 20 MB" }, { status: 400 });
      }
      if (doc.urlArchivo) {
        await eliminarArchivo(doc.urlArchivo);
        if (doc.urlArchivo.startsWith("/")) {
          try { await unlink(path.join(process.cwd(), "public", doc.urlArchivo)); } catch {}
        }
      }
      if (isPdf) {
        const safeName = `ordendel_${Date.now()}_${randomBytes(4).toString("hex")}.pdf`;
        data.urlArchivo = await subirArchivo("orden-del-dia", safeName, file, PDF_MIME);
        data.tipoArchivo = "PDF";
      } else {
        const safeName = generarNombreAlmacenamientoModeloWord(file.name, "ordendel");
        const mime = contentTypeWordSubida(file.name, file.type ?? "");
        data.urlArchivo = await subirArchivo("orden-del-dia", safeName, file, mime);
        data.tipoArchivo = mime === DOC_MIME || isDoc ? "DOC" : "DOCX";
      }
      data.nombreArchivo = file.name;
    }

    const updated = await prisma.documentoOrdenDia.update({
      where: { id },
      data: data as Parameters<typeof prisma.documentoOrdenDia.update>[0]["data"],
      include: { categoria: { select: { id: true, nombre: true } } },
    });

    const user = session?.user as { id?: string; name?: string; email?: string };
    await registrarAuditoria({
      userId: user?.id ?? "",
      userNombre: user?.name ?? "",
      userEmail: user?.email ?? "",
      accion: "Editó un documento de Orden del día C.S.",
      modulo: "Secretaría",
      ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? undefined,
    });
    return NextResponse.json(updated);
  } catch (e) {
    console.error("Error actualizando documento orden del día:", e);
    return NextResponse.json({ error: "Error al actualizar el documento" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const roles = (session?.user as { roles?: unknown })?.roles ?? [];
  if (!canWrite(roles)) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const id = parseId((await params).id);
  if (id === null) return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  const doc = await prisma.documentoOrdenDia.findUnique({ where: { id } });
  if (!doc) return NextResponse.json({ error: "Documento no encontrado" }, { status: 404 });
  if (doc.urlArchivo) {
    await eliminarArchivo(doc.urlArchivo);
    if (doc.urlArchivo.startsWith("/")) {
      try { await unlink(path.join(process.cwd(), "public", doc.urlArchivo)); } catch {}
    }
  }
  await prisma.documentoOrdenDia.delete({ where: { id } });
  const user = session?.user as { id?: string; name?: string; email?: string };
  await registrarAuditoria({
    userId: user?.id ?? "",
    userNombre: user?.name ?? "",
    userEmail: user?.email ?? "",
    accion: "Eliminó un documento de Orden del día C.S.",
    modulo: "Secretaría",
    ip: _req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? undefined,
  });
  return NextResponse.json({ success: true });
}
