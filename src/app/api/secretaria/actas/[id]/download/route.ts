import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { esBlobUrl, servirBlobDesdeApi } from "@/lib/blob";
import { readFile } from "fs/promises";
import path from "path";

const ROLES = ["ADMIN", "SECRETARIA"] as const;

function canAccess(roles: string[]) {
  return ROLES.some((r) => roles.includes(r));
}

function parseId(id: string): number | null {
  const n = parseInt(id, 10);
  return isNaN(n) ? null : n;
}

/** GET - Descargar archivo del acta (.docx o .pdf). ?inline=true → abrir en navegador (imprimir). */
export async function GET(
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

  const acta = await prisma.acta.findUnique({ where: { id } });
  if (!acta) {
    return NextResponse.json({ error: "Acta no encontrada" }, { status: 404 });
  }

  if (!acta.urlArchivo) {
    return NextResponse.json(
      { error: "Esta acta no tiene archivo adjunto" },
      { status: 404 }
    );
  }

  const { searchParams } = new URL(req.url);
  const inline = searchParams.get("inline") === "true";
  const filename = acta.nombreArchivo || "acta.docx";
  const esPdf = filename.toLowerCase().endsWith(".pdf");
  const contentType = esPdf
    ? "application/pdf"
    : "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

  if (esBlobUrl(acta.urlArchivo)) {
    return servirBlobDesdeApi(
      acta.urlArchivo,
      filename,
      contentType,
      inline
    );
  }

  const filePath = path.join(process.cwd(), "public", acta.urlArchivo);
  let buffer: Buffer;
  try {
    buffer = await readFile(filePath);
  } catch {
    return NextResponse.json(
      { error: "Archivo no encontrado" },
      { status: 404 }
    );
  }

  const disposition = inline
    ? `inline; filename="${encodeURIComponent(filename)}"`
    : `attachment; filename="${encodeURIComponent(filename)}"`;
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": disposition,
    },
  });
}
