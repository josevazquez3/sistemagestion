import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { esBlobUrl } from "@/lib/blob";
import mammoth from "mammoth";
import { esWordDocBinario } from "@/lib/legales/modelosOficioArchivo";
import { readFile } from "fs/promises";
import path from "path";

const ROLES = ["ADMIN", "LEGALES"] as const;

function canAccess(roles: string[]) {
  return ROLES.some((r) => roles.includes(r));
}

function parseId(id: string): number | null {
  const n = parseInt(id, 10);
  return isNaN(n) ? null : n;
}

/** GET - Convertir DOCX a HTML para impresión */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const roles = (session?.user as { roles?: string[] })?.roles ?? [];
  if (!canAccess(roles)) {
    return new NextResponse("No autorizado", { status: 403 });
  }

  const id = parseId((await params).id);
  if (id === null) {
    return new NextResponse("ID inválido", { status: 400 });
  }

  const modelo = await prisma.modeloOficio.findUnique({ where: { id } });
  if (!modelo) {
    return new NextResponse("Modelo no encontrado", { status: 404 });
  }

  try {
    let buffer: Buffer;

    if (esBlobUrl(modelo.urlArchivo)) {
      const response = await fetch(modelo.urlArchivo);
      const arrayBuffer = await response.arrayBuffer();
      buffer = Buffer.from(arrayBuffer);
    } else if (modelo.contenido && modelo.contenido.length > 0) {
      buffer = Buffer.from(modelo.contenido);
    } else {
      const filePath = path.join(process.cwd(), "public", modelo.urlArchivo);
      buffer = await readFile(filePath);
    }

    const titulo = modelo.nombre ?? modelo.nombreArchivo ?? "Modelo de oficio";

    let htmlContenido: string;
    if (esWordDocBinario(modelo.nombreArchivo)) {
      htmlContenido = `<div style="padding:2rem;font-family:Arial,sans-serif;max-width:560px;">
        <p><strong>${titulo}</strong></p>
        <p style="margin-top:1rem;color:#444;">Vista previa e impresión no disponibles para archivos <strong>.doc</strong> (formato Word antiguo).</p>
        <p style="margin-top:0.75rem;">Usá <strong>Descargar</strong> en la tabla de modelos para abrir el archivo en Microsoft Word.</p>
      </div>`;
    } else {
      const resultado = await mammoth.convertToHtml({ buffer });
      htmlContenido = resultado.value;
    }

    const htmlCompleto = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${titulo}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, sans-serif; font-size: 12pt; line-height: 1.5; padding: 2cm; color: #000; }
    h1, h2, h3, h4, h5, h6 { margin-bottom: 0.5em; margin-top: 1em; }
    p { margin-bottom: 0.5em; }
    table { border-collapse: collapse; width: 100%; margin-bottom: 1em; }
    td, th { border: 1px solid #ccc; padding: 4px 8px; }
    img { max-width: 100%; }
    @media print { body { padding: 0; } @page { margin: 2cm; } }
  </style>
</head>
<body>
  ${htmlContenido}
  <script>window.addEventListener('load', () => { window.print(); });</script>
</body>
</html>`;

    return new NextResponse(htmlCompleto, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Error convirtiendo DOCX (modelos oficio):", error);
    return new NextResponse("Error al procesar el documento", { status: 500 });
  }
}
