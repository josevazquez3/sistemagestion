import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { subirArchivo } from "@/lib/blob";
import { extraerHtmlDeDocx } from "@/lib/docx/extractorContenido";
import { generarDocxDesdeHtml } from "@/lib/docx/generadorDocx";

const ROLES = ["ADMIN", "SECRETARIA"] as const;

function canAccess(roles: string[]) {
  return ROLES.some((r) => roles.includes(r));
}

function parseId(id: string): number | null {
  const n = parseInt(id, 10);
  return isNaN(n) ? null : n;
}

/** GET - Extraer HTML editable del DOCX */
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
    include: { tipoNota: { select: { id: true, nombre: true } } },
  });
  if (!modelo) {
    return NextResponse.json({ error: "Modelo no encontrado" }, { status: 404 });
  }

  let buffer: Buffer;
  if (modelo.contenido && modelo.contenido.length > 0) {
    buffer = Buffer.from(modelo.contenido);
  } else {
    const res = await fetch(modelo.urlArchivo);
    if (!res.ok) {
      return NextResponse.json({ error: "No se pudo acceder al archivo" }, { status: 500 });
    }
    buffer = Buffer.from(await res.arrayBuffer());
  }

  const html = await extraerHtmlDeDocx(buffer);
  return NextResponse.json({
    html,
    nombre: modelo.nombre,
    tipoNota: modelo.tipoNota.nombre,
    tipoNotaId: modelo.tipoNotaId,
  });
}

/** PUT - Guardar HTML editado y regenerar .docx (actualizar o guardar como nuevo) */
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

  let body: { html?: string; nombre?: string; tipoNotaId?: number; guardarComo?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
  }
  if (!body.html) {
    return NextResponse.json({ error: "El contenido es requerido" }, { status: 400 });
  }

  const nombreFinal = (body.nombre || modelo.nombre).trim();
  const tipoFinal = body.tipoNotaId ?? modelo.tipoNotaId;

  const buffer = await generarDocxDesdeHtml(body.html, nombreFinal);
  const arrayBuffer = buffer.buffer.slice(
    buffer.byteOffset,
    buffer.byteOffset + buffer.byteLength
  ) as ArrayBuffer;
  const bytes = new Uint8Array(arrayBuffer);

  const safeNombre = nombreFinal
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "_")
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/_+/g, "_")
    .toLowerCase();
  const nombreArchivo = `${safeNombre}_${Date.now()}.docx`;

  const urlArchivo = await subirArchivo(
    "modelos-notas",
    nombreArchivo,
    buffer,
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  );

  if (body.guardarComo) {
    const include = {
      tipoNota: { select: { id: true, nombre: true, activo: true } },
    } as const;
    const dataBase = {
      nombre: nombreFinal,
      tipoNotaId: tipoFinal,
      nombreArchivo,
      urlArchivo,
      contenido: bytes,
    };
    let nuevo;
    try {
      nuevo = await prisma.modeloNota.create({
        data: { ...dataBase, modeloOrigenId: id, activo: true },
        include,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      if (
        e instanceof Error &&
        e.name === "PrismaClientValidationError" &&
        (msg.includes("modeloOrigenId") || msg.includes("activo"))
      ) {
        nuevo = await prisma.modeloNota.create({ data: dataBase, include });
      } else {
        throw e;
      }
    }
    return NextResponse.json({ modelo: nuevo, accion: "creado" }, { status: 201 });
  }

  const actualizado = await prisma.modeloNota.update({
    where: { id },
    data: {
      nombre: nombreFinal,
      tipoNotaId: tipoFinal,
      nombreArchivo,
      urlArchivo,
      contenido: bytes,
    },
    include: { tipoNota: { select: { id: true, nombre: true, activo: true } } },
  });
  return NextResponse.json({ modelo: actualizado, accion: "actualizado" });
}
