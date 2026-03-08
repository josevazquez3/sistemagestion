import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { esBlobUrl, servirBlobDesdeApi } from "@/lib/blob";
import { readFile } from "fs/promises";
import path from "path";

function parseId(id: string): number | null {
  const n = parseInt(id, 10);
  return isNaN(n) ? null : n;
}

/** GET - Descargar archivo del documento. ?inline=true → abrir en navegador (imprimir). */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const id = parseId((await params).id);
  if (id === null) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }

  const doc = await prisma.documentoOrdenDia.findUnique({ where: { id } });
  if (!doc) {
    return NextResponse.json({ error: "Documento no encontrado" }, { status: 404 });
  }

  if (!doc.urlArchivo) {
    return NextResponse.json(
      { error: "Este documento no tiene archivo" },
      { status: 404 }
    );
  }

  const { searchParams } = new URL(req.url);
  const inline = searchParams.get("inline") === "true";

  if (esBlobUrl(doc.urlArchivo)) {
    const filename =
      doc.nombreArchivo ||
      `documento.${doc.tipoArchivo?.toLowerCase() || "pdf"}`;
    const contentType =
      doc.tipoArchivo === "PDF"
        ? "application/pdf"
        : "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    return servirBlobDesdeApi(
      doc.urlArchivo,
      filename,
      contentType,
      inline
    );
  }

  const filePath = path.join(process.cwd(), "public", doc.urlArchivo);
  let buffer: Buffer;
  try {
    buffer = await readFile(filePath);
  } catch {
    return NextResponse.json(
      { error: "Archivo no encontrado" },
      { status: 404 }
    );
  }

  const contentType =
    doc.tipoArchivo === "PDF"
      ? "application/pdf"
      : "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  const filename = doc.nombreArchivo || `documento.${doc.tipoArchivo?.toLowerCase() || "pdf"}`;
  const disposition = inline
    ? "inline"
    : `attachment; filename="${encodeURIComponent(filename)}"`;

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": disposition,
    },
  });
}
