import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
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

/** GET - Descargar .docx del modelo */
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
  } else {
    const filePath = path.join(process.cwd(), "public", modelo.urlArchivo);
    try {
      buffer = await readFile(filePath);
    } catch {
      return NextResponse.json({ error: "Archivo no encontrado" }, { status: 404 });
    }
  }

  const filename = modelo.nombreArchivo || "modelo.docx";
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${encodeURIComponent(filename)}"`,
    },
  });
}
