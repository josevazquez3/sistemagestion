import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { subirArchivo } from "@/lib/blob";
import { extraerHtmlDeDocx } from "@/lib/docx/extractorContenido";
import { generarDocxDesdeHtml } from "@/lib/docx/generadorDocx";
import { esWordDocBinario } from "@/lib/legales/modelosOficioArchivo";

const ROLES = ["ADMIN", "LEGALES"] as const;

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
  if (id === null) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }

  const modelo = await prisma.modeloOficio.findUnique({
    where: { id },
    include: { tipoOficio: { select: { id: true, nombre: true } } },
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
      return NextResponse.json(
        { error: "No se pudo acceder al archivo" },
        { status: 500 }
      );
    }
    buffer = Buffer.from(await res.arrayBuffer());
  }

  if (esWordDocBinario(modelo.nombreArchivo)) {
    return NextResponse.json({
      html: "",
      previewNoDisponible: true,
      mensajePreview:
        "Vista previa no disponible para archivos .doc (formato antiguo). Descargá el archivo para editarlo en Word.",
      nombre: modelo.nombre,
      tipoOficio: modelo.tipoOficio.nombre,
      tipoOficioId: modelo.tipoOficioId,
    });
  }

  const html = await extraerHtmlDeDocx(buffer);

  return NextResponse.json({
    html,
    previewNoDisponible: false,
    nombre: modelo.nombre,
    tipoOficio: modelo.tipoOficio.nombre,
    tipoOficioId: modelo.tipoOficioId,
  });
}

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

  let body: {
    html?: string;
    nombre?: string;
    tipoOficioId?: number;
    guardarComo?: boolean;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
  }

  if (!body.html) {
    return NextResponse.json({ error: "El contenido es requerido" }, { status: 400 });
  }

  const modelo = await prisma.modeloOficio.findUnique({ where: { id } });
  if (!modelo) {
    return NextResponse.json({ error: "Modelo no encontrado" }, { status: 404 });
  }
  if (esWordDocBinario(modelo.nombreArchivo)) {
    return NextResponse.json(
      {
        error:
          "No se puede guardar contenido desde el editor web sobre un .doc. Subí una versión .docx o reemplazá el archivo por uno .docx.",
      },
      { status: 400 }
    );
  }

  const nombreFinal = (body.nombre || modelo.nombre).trim();
  const tipoFinal = body.tipoOficioId ?? modelo.tipoOficioId;

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
    "modelos-oficios",
    nombreArchivo,
    buffer,
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  );

  if (body.guardarComo) {
    const nuevo = await prisma.modeloOficio.create({
      data: {
        nombre: nombreFinal,
        tipoOficioId: tipoFinal,
        nombreArchivo,
        urlArchivo,
        contenido: bytes,
        // Si el esquema Prisma aún no tiene modeloOrigenId/activo,
        // estos campos se ignoran sin afectar el flujo principal.
      },
      include: { tipoOficio: { select: { id: true, nombre: true, activo: true } } },
    });
    return NextResponse.json({ modelo: nuevo, accion: "creado" }, { status: 201 });
  }

  const actualizado = await prisma.modeloOficio.update({
    where: { id },
    data: {
      nombre: nombreFinal,
      tipoOficioId: tipoFinal,
      nombreArchivo,
      urlArchivo,
      contenido: bytes,
    },
    include: { tipoOficio: { select: { id: true, nombre: true, activo: true } } },
  });

  return NextResponse.json({ modelo: actualizado, accion: "actualizado" });
}

