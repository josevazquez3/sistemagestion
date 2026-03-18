import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { registrarAuditoria } from "@/lib/auditoria";
import type { Prisma } from "@prisma/client";
import { subirArchivo } from "@/lib/blob";
import {
  validarArchivoWordModelo,
  generarNombreAlmacenamientoModeloWord,
  contentTypeWordSubida,
} from "@/lib/legales/modelosOficioArchivo";

const ROLES = ["ADMIN", "LEGALES"] as const;
const MAX_FILE_SIZE = 10 * 1024 * 1024;

function canAccess(roles: string[]) {
  return ROLES.some((r) => roles.includes(r));
}

export async function GET(req: NextRequest) {
  const session = await auth();
  const roles = (session?.user as { roles?: string[] })?.roles ?? [];
  if (!canAccess(roles)) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim() ?? "";
  const tipoOficioId = searchParams.get("tipoOficioId");
  const estado = searchParams.get("estado") ?? "todos";

  const where: Prisma.ModeloOficioWhereInput = {};
  const tipoOficioIs: { id?: number; activo?: boolean } = {};
  if (estado === "activos") tipoOficioIs.activo = true;
  if (tipoOficioId && tipoOficioId !== "todos") {
    const id = parseInt(tipoOficioId, 10);
    if (!isNaN(id)) tipoOficioIs.id = id;
  }
  if (Object.keys(tipoOficioIs).length > 0) where.tipoOficio = { is: tipoOficioIs };
  if (q) {
    where.OR = [
      { nombre: { contains: q, mode: "insensitive" } },
      { nombreArchivo: { contains: q, mode: "insensitive" } },
      { tipoOficio: { nombre: { contains: q, mode: "insensitive" } } },
    ];
  }

  const modelos = await prisma.modeloOficio.findMany({
    where,
    include: { tipoOficio: { select: { id: true, nombre: true, activo: true } } },
    orderBy: [{ tipoOficio: { nombre: "asc" } }, { nombre: "asc" }],
  });
  return NextResponse.json({ data: modelos });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  const roles = (session?.user as { roles?: string[] })?.roles ?? [];
  if (!canAccess(roles)) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  try {
    const formData = await req.formData();
    const tipoOficioIdStr = formData.get("tipoOficioId") as string | null;
    const nombre = (formData.get("nombre") as string)?.trim();
    const fileRaw = formData.get("file");
    if (!tipoOficioIdStr || !nombre) {
      return NextResponse.json({ error: "Tipo de oficio y nombre son obligatorios" }, { status: 400 });
    }
    if (!fileRaw || typeof fileRaw === "string") {
      return NextResponse.json({ error: "Debe adjuntar un archivo Word (.docx)" }, { status: 400 });
    }
    const file = fileRaw as File;
    const tipoOficioId = parseInt(tipoOficioIdStr, 10);
    if (isNaN(tipoOficioId)) {
      return NextResponse.json({ error: "Tipo de oficio inválido" }, { status: 400 });
    }
    const tipo = await prisma.tipoOficio.findUnique({ where: { id: tipoOficioId } });
    if (!tipo || !tipo.activo) {
      return NextResponse.json({ error: "Tipo de oficio no encontrado o inactivo" }, { status: 400 });
    }
    const v = validarArchivoWordModelo(file, MAX_FILE_SIZE);
    if (!v.ok) {
      return NextResponse.json({ error: v.error }, { status: 400 });
    }

    const safeName = generarNombreAlmacenamientoModeloWord(file.name);
    const buffer = Buffer.from(await file.arrayBuffer());
    const arrayBuffer = buffer.buffer.slice(
      buffer.byteOffset,
      buffer.byteOffset + buffer.byteLength
    ) as ArrayBuffer;
    const bytes = new Uint8Array(arrayBuffer);
    const contentType = contentTypeWordSubida(file.name, file.type);
    const urlArchivo = await subirArchivo("modelos-oficios", safeName, buffer, contentType);

    const modelo = await prisma.modeloOficio.create({
      data: {
        tipoOficioId,
        nombre,
        nombreArchivo: file.name,
        urlArchivo,
        contenido: bytes,
      },
      include: { tipoOficio: { select: { id: true, nombre: true, activo: true } } },
    });

    const user = session?.user as { id?: string; name?: string; email?: string };
    await registrarAuditoria({
      userId: user?.id ?? "",
      userNombre: user?.name ?? "",
      userEmail: user?.email ?? "",
      accion: "Subió un modelo de oficio",
      modulo: "Legales",
      ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? undefined,
    });
    return NextResponse.json(modelo);
  } catch (e) {
    console.error("Error subiendo modelo de oficio:", e);
    return NextResponse.json({ error: "Error al subir el modelo" }, { status: 500 });
  }
}
