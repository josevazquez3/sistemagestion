import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { subirArchivo } from "@/lib/blob";
import {
  validarArchivoWordModelo,
  generarNombreAlmacenamientoModeloWord,
  contentTypeWordSubida,
} from "@/lib/legales/modelosOficioArchivo";

const ROLES = ["ADMIN", "SECRETARIA"] as const;
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

function canAccess(roles: string[]) {
  return ROLES.some((r) => roles.includes(r));
}

/** GET - Listar modelos con búsqueda y filtros */
export async function GET(req: NextRequest) {
  const session = await auth();
  const roles = (session?.user as { roles?: string[] })?.roles ?? [];
  if (!canAccess(roles)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim() ?? "";
  const tipoNotaId = searchParams.get("tipoNotaId");
  const estado = searchParams.get("estado") ?? "todos"; // todos | activos

  const where: Prisma.ModeloNotaWhereInput = {};

  const tipoNotaIs: { id?: number; activo?: boolean } = {};
  if (estado === "activos") tipoNotaIs.activo = true;
  if (tipoNotaId && tipoNotaId !== "todos") {
    const id = parseInt(tipoNotaId, 10);
    if (!isNaN(id)) tipoNotaIs.id = id;
  }
  if (Object.keys(tipoNotaIs).length > 0) {
    where.tipoNota = { is: tipoNotaIs };
  }

  if (q) {
    where.OR = [
      { nombre: { contains: q, mode: "insensitive" } },
      { nombreArchivo: { contains: q, mode: "insensitive" } },
      { tipoNota: { nombre: { contains: q, mode: "insensitive" } } },
    ];
  }

  const modelos = await prisma.modeloNota.findMany({
    where,
    include: {
      tipoNota: { select: { id: true, nombre: true, activo: true } },
    },
    orderBy: [{ tipoNota: { nombre: "asc" } }, { nombre: "asc" }],
  });

  return NextResponse.json({ data: modelos });
}

/** POST - Subir nuevo modelo (multipart: tipoNotaId, nombre, file) */
export async function POST(req: NextRequest) {
  const session = await auth();
  const roles = (session?.user as { roles?: string[] })?.roles ?? [];
  if (!canAccess(roles)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  try {
    const formData = await req.formData();
    const tipoNotaIdStr = formData.get("tipoNotaId") as string | null;
    const nombre = (formData.get("nombre") as string)?.trim();
    const fileRaw = formData.get("file");

    if (!tipoNotaIdStr || !nombre) {
      return NextResponse.json(
        { error: "Tipo de nota y nombre son obligatorios" },
        { status: 400 }
      );
    }
    if (!fileRaw || typeof fileRaw === "string") {
      return NextResponse.json(
        { error: "Debe adjuntar un archivo Word (.docx)" },
        { status: 400 }
      );
    }
    const file = fileRaw as File;

    const tipoNotaId = parseInt(tipoNotaIdStr, 10);
    if (isNaN(tipoNotaId)) {
      return NextResponse.json({ error: "Tipo de nota inválido" }, { status: 400 });
    }

    const tipo = await prisma.tipoNota.findUnique({ where: { id: tipoNotaId } });
    if (!tipo || !tipo.activo) {
      return NextResponse.json({ error: "Tipo de nota no encontrado o inactivo" }, { status: 400 });
    }

    const v = validarArchivoWordModelo(file, MAX_FILE_SIZE);
    if (!v.ok) {
      return NextResponse.json({ error: v.error }, { status: 400 });
    }

    const safeName = generarNombreAlmacenamientoModeloWord(file.name, "modelonota");
    const buffer = Buffer.from(await file.arrayBuffer());
    const mime = contentTypeWordSubida(file.name, file.type);
    const urlArchivo = await subirArchivo("modelos-notas", safeName, buffer, mime);

    const modelo = await prisma.modeloNota.create({
      data: {
        tipoNotaId,
        nombre,
        nombreArchivo: file.name,
        urlArchivo,
        contenido: buffer,
      },
      include: {
        tipoNota: { select: { id: true, nombre: true, activo: true } },
      },
    });

    return NextResponse.json(modelo);
  } catch (e) {
    console.error("Error subiendo modelo de nota:", e);
    return NextResponse.json(
      { error: "Error al subir el modelo" },
      { status: 500 }
    );
  }
}
