import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { subirArchivo, esBlobUrl } from "@/lib/blob";
import { readFile } from "fs/promises";
import path from "path";
import mammoth from "mammoth";
import { Document, Packer, Paragraph, TextRun } from "docx";

const ROLES = ["ADMIN", "SECRETARIA"] as const;

function canAccess(roles: string[]) {
  return ROLES.some((r) => roles.includes(r));
}

function parseId(id: string): number | null {
  const n = parseInt(id, 10);
  return isNaN(n) ? null : n;
}

/** GET - Extraer texto del DOCX (mammoth) para edición */
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

  const modelo = await prisma.modeloNota.findUnique({ where: { id } });
  if (!modelo) {
    return NextResponse.json({ error: "Modelo no encontrado" }, { status: 404 });
  }

  let buffer: Buffer;
  if (modelo.contenido && modelo.contenido.length > 0) {
    buffer = Buffer.from(modelo.contenido);
  } else if (esBlobUrl(modelo.urlArchivo)) {
    const res = await fetch(modelo.urlArchivo);
    if (!res.ok) return NextResponse.json({ error: "Archivo no encontrado" }, { status: 404 });
    buffer = Buffer.from(await res.arrayBuffer());
  } else {
    const filePath = path.join(process.cwd(), "public", modelo.urlArchivo);
    try {
      buffer = await readFile(filePath);
    } catch {
      return NextResponse.json({ error: "Archivo no encontrado" }, { status: 404 });
    }
  }

  try {
    const result = await mammoth.extractRawText({ buffer });
    const text = result.value || "";
    return NextResponse.json({ text });
  } catch (e) {
    console.error("Error extrayendo texto con mammoth:", e);
    return NextResponse.json(
      { error: "No se pudo extraer el texto del documento" },
      { status: 500 }
    );
  }
}

/** POST - Guardar contenido editado: regenera .docx con Document/Paragraph/TextRun/Packer */
export async function POST(
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

  try {
    const body = await req.json();
    const text = typeof body.texto === "string" ? body.texto : "";

    const lines = text.split(/\r?\n/);
    const children =
      lines.length > 0
        ? lines.map(
            (line: string) =>
              new Paragraph({
                children: [new TextRun(line || " ")],
                spacing: { after: 200 },
              })
          )
        : [new Paragraph({ children: [new TextRun(" ")], spacing: { after: 200 } })];

    const doc = new Document({ sections: [{ children }] });
    const buffer = Buffer.from(await Packer.toBuffer(doc));

    const safeName = `${Date.now()}-${modelo.nombreArchivo.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const urlArchivo = await subirArchivo(
      "modelos-notas",
      safeName,
      buffer,
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    );

    await prisma.modeloNota.update({
      where: { id },
      data: {
        urlArchivo,
        contenido: buffer,
        nombreArchivo: modelo.nombreArchivo,
      },
    });

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("Error guardando contenido:", e);
    return NextResponse.json(
      { error: "Error al guardar el contenido" },
      { status: 500 }
    );
  }
}
