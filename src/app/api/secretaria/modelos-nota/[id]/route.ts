import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { subirArchivo, eliminarArchivo } from "@/lib/blob";
import path from "path";
import {
  validarArchivoWordModelo,
  generarNombreAlmacenamientoModeloWord,
  contentTypeWordSubida,
} from "@/lib/legales/modelosOficioArchivo";
import { unlink } from "fs/promises";

const ROLES = ["ADMIN", "SECRETARIA"] as const;
const MAX_FILE_SIZE = 10 * 1024 * 1024;
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

      const data: Prisma.ModeloNotaUncheckedUpdateInput = {};
      if (nombre) data.nombre = nombre;
      if (tipoNotaIdStr) {
        const tid = parseInt(tipoNotaIdStr, 10);
        if (!isNaN(tid)) data.tipoNotaId = tid;
      }

      if (file && file.size > 0) {
        const v = validarArchivoWordModelo(file, MAX_FILE_SIZE);
        if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });
        const safeName = generarNombreAlmacenamientoModeloWord(file.name, "modelonota");
        const buffer = Buffer.from(await file.arrayBuffer());
        const mime = contentTypeWordSubida(file.name, file.type);
        data.urlArchivo = await subirArchivo("modelos-notas", safeName, buffer, mime);
        data.nombreArchivo = file.name;
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

  await eliminarArchivo(modelo.urlArchivo);
  if (modelo.urlArchivo.startsWith("/")) {
    try {
      const filePath = path.join(process.cwd(), "public", modelo.urlArchivo);
      await unlink(filePath);
    } catch {
      // ignorar si el archivo no existe (legacy)
    }
  }

  await prisma.modeloNota.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
