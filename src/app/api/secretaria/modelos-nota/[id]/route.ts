import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { writeFile, mkdir, unlink } from "fs/promises";
import path from "path";
import { randomBytes } from "crypto";

const ROLES = ["ADMIN", "SECRETARIA"] as const;
const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "modelos-notas");

function canAccess(roles: string[]) {
  return ROLES.some((r) => roles.includes(r));
}

function parseId(id: string): number | null {
  const n = parseInt(id, 10);
  return isNaN(n) ? null : n;
}

/** GET - Obtener un modelo por ID */
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
  if (id === null) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }

  const modelo = await prisma.modeloNota.findUnique({
    where: { id },
    include: {
      tipoNota: { select: { id: true, nombre: true, activo: true } },
    },
  });

  if (!modelo) {
    return NextResponse.json({ error: "Modelo no encontrado" }, { status: 404 });
  }

  const { contenido, ...rest } = modelo;
  return NextResponse.json({ ...rest, tieneContenido: !!contenido });
}

/** PUT - Actualizar modelo (nombre, tipoNotaId, opcional reemplazar archivo) */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const roles = (session?.user as { roles?: string[] })?.roles ?? [];
  if (!canAccess(roles)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const id = parseId((await params).id);
  if (id === null) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }

  const modelo = await prisma.modeloNota.findUnique({ where: { id } });
  if (!modelo) {
    return NextResponse.json({ error: "Modelo no encontrado" }, { status: 404 });
  }

  const contentType = req.headers.get("content-type") ?? "";
  const isMultipart = contentType.includes("multipart/form-data");

  if (isMultipart) {
    try {
      const formData = await req.formData();
      const nombre = (formData.get("nombre") as string)?.trim();
      const tipoNotaIdStr = formData.get("tipoNotaId") as string | null;
      const file = formData.get("file") as File | null;

      const data: { nombre?: string; tipoNotaId?: number; nombreArchivo?: string; urlArchivo?: string; contenido?: Buffer } = {};
      if (nombre) data.nombre = nombre;
      if (tipoNotaIdStr) {
        const tid = parseInt(tipoNotaIdStr, 10);
        if (!isNaN(tid)) data.tipoNotaId = tid;
      }

      if (file && file.size > 0) {
        const name = file.name.toLowerCase();
        if (!name.endsWith(".docx")) {
          return NextResponse.json({ error: "Solo se permiten archivos .docx" }, { status: 400 });
        }
        const contentType = file.type?.toLowerCase() ?? "";
        const validMime =
          contentType === DOCX_MIME ||
          contentType === "application/octet-stream" ||
          contentType === "";
        if (!validMime) {
          return NextResponse.json(
            { error: "Tipo de archivo no válido. Debe ser .docx" },
            { status: 400 }
          );
        }
        if (file.size > MAX_FILE_SIZE) {
          return NextResponse.json({ error: "El archivo no puede superar 10 MB" }, { status: 400 });
        }
        await mkdir(UPLOAD_DIR, { recursive: true });
        const timestamp = Date.now();
        const random = randomBytes(4).toString("hex");
        const safeName = `modelonota_${timestamp}_${random}.docx`;
        const filePath = path.join(UPLOAD_DIR, safeName);
        const buffer = Buffer.from(await file.arrayBuffer());
        await writeFile(filePath, buffer);
        data.nombreArchivo = file.name;
        data.urlArchivo = `/uploads/modelos-notas/${safeName}`;
        data.contenido = buffer;
      }

      const updated = await prisma.modeloNota.update({
        where: { id },
        data,
        include: {
          tipoNota: { select: { id: true, nombre: true, activo: true } },
        },
      });

      const { contenido, ...rest } = updated;
      return NextResponse.json({ ...rest, tieneContenido: !!contenido });
    } catch (e) {
      console.error("Error actualizando modelo:", e);
      return NextResponse.json({ error: "Error al actualizar modelo" }, { status: 500 });
    }
  }

  try {
    const body = await req.json();
    const { nombre, tipoNotaId: tid } = body;
    const data: { nombre?: string; tipoNotaId?: number } = {};
    if (typeof nombre === "string" && nombre.trim()) data.nombre = nombre.trim();
    if (tid !== undefined) {
      const n = parseInt(String(tid), 10);
      if (!isNaN(n)) data.tipoNotaId = n;
    }

    const updated = await prisma.modeloNota.update({
      where: { id },
      data,
      include: {
        tipoNota: { select: { id: true, nombre: true, activo: true } },
      },
    });

    const { contenido, ...rest } = updated;
    return NextResponse.json({ ...rest, tieneContenido: !!contenido });
  } catch (e) {
    console.error("Error actualizando modelo:", e);
    return NextResponse.json({ error: "Error al actualizar modelo" }, { status: 500 });
  }
}

/** DELETE - Eliminar modelo */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const roles = (session?.user as { roles?: string[] })?.roles ?? [];
  if (!canAccess(roles)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const id = parseId((await params).id);
  if (id === null) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }

  const modelo = await prisma.modeloNota.findUnique({ where: { id } });
  if (!modelo) {
    return NextResponse.json({ error: "Modelo no encontrado" }, { status: 404 });
  }

  const filePath = path.join(process.cwd(), "public", modelo.urlArchivo);
  try {
    await unlink(filePath);
  } catch {
    // ignorar si el archivo no existe
  }

  await prisma.modeloNota.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
