import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { randomBytes } from "crypto";

const ROLES = ["ADMIN", "SECRETARIA"] as const;
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

function canAccess(roles: string[]) {
  return ROLES.some((r) => roles.includes(r));
}

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "modelos-notas");

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
    const file = formData.get("file") as File | null;

    if (!tipoNotaIdStr || !nombre) {
      return NextResponse.json(
        { error: "Tipo de nota y nombre son obligatorios" },
        { status: 400 }
      );
    }

    const tipoNotaId = parseInt(tipoNotaIdStr, 10);
    if (isNaN(tipoNotaId)) {
      return NextResponse.json({ error: "Tipo de nota inválido" }, { status: 400 });
    }

    const tipo = await prisma.tipoNota.findUnique({ where: { id: tipoNotaId } });
    if (!tipo || !tipo.activo) {
      return NextResponse.json({ error: "Tipo de nota no encontrado o inactivo" }, { status: 400 });
    }

    if (!file || file.size === 0) {
      return NextResponse.json(
        { error: "Debe seleccionar un archivo .docx" },
        { status: 400 }
      );
    }

    const name = file.name.toLowerCase();
    if (!name.endsWith(".docx")) {
      return NextResponse.json(
        { error: "Solo se permiten archivos .docx" },
        { status: 400 }
      );
    }

    const contentType = file.type?.toLowerCase() ?? "";
    const validMime =
      contentType === DOCX_MIME ||
      contentType === "application/octet-stream" ||
      contentType === "";
    if (!validMime) {
      return NextResponse.json(
        {
          error:
            "Tipo de archivo no válido. Debe ser .docx (application/vnd.openxmlformats-officedocument.wordprocessingml.document)",
        },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "El archivo no puede superar 10 MB" },
        { status: 400 }
      );
    }

    await mkdir(UPLOAD_DIR, { recursive: true });

    const timestamp = Date.now();
    const random = randomBytes(4).toString("hex");
    const safeName = `modelonota_${timestamp}_${random}.docx`;
    const filePath = path.join(UPLOAD_DIR, safeName);
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(filePath, buffer);

    const urlArchivo = `/uploads/modelos-notas/${safeName}`;

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
