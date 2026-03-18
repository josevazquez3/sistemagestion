import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { esBlobUrl } from "@/lib/blob";
import mammoth from "mammoth";
import { readFile } from "fs/promises";
import path from "path";
import { esWordDocBinario } from "@/lib/legales/modelosOficioArchivo";

function parseId(id: string): number | null {
  const n = parseInt(id, 10);
  return isNaN(n) ? null : n;
}

/** GET - Convertir DOCX a HTML para impresión. Solo DOCX; para PDF use download?inline=true */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return new NextResponse("No autorizado", { status: 401 });
  }

  const id = parseId((await params).id);
  if (id === null) {
    return new NextResponse("ID inválido", { status: 400 });
  }

  const doc = await prisma.documentoOrdenDia.findUnique({ where: { id } });
  if (!doc || !doc.urlArchivo) {
    return new NextResponse("Documento no encontrado", { status: 404 });
  }

  if (doc.tipoArchivo === "PDF") {
    return new NextResponse("Para PDF use la opción de descarga con imprimir", {
      status: 400,
    });
  }

  if (doc.tipoArchivo === "DOC" || esWordDocBinario(doc.nombreArchivo)) {
    const raw = doc.titulo ?? doc.nombreArchivo ?? "Documento";
    const titulo = raw
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
    const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${titulo}</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 2rem; max-width: 640px; margin: 0 auto; color: #333; }
    h1 { font-size: 1.25rem; }
    p { line-height: 1.5; }
  </style>
</head>
<body>
  <h1>Impresión no disponible</h1>
  <p>Los archivos en formato Word antiguo (.doc) no se pueden convertir a vista imprimible en el navegador.</p>
  <p>Descargá el archivo y abrilo en Microsoft Word u otro programa compatible para imprimirlo.</p>
</body>
</html>`;
    return new NextResponse(html, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  }

  try {
    let buffer: Buffer;

    if (esBlobUrl(doc.urlArchivo)) {
      const response = await fetch(doc.urlArchivo);
      const arrayBuffer = await response.arrayBuffer();
      buffer = Buffer.from(arrayBuffer);
    } else {
      const filePath = path.join(process.cwd(), "public", doc.urlArchivo);
      buffer = await readFile(filePath);
    }

    const resultado = await mammoth.convertToHtml({ buffer });
    const htmlContenido = resultado.value;
    const titulo = doc.titulo ?? doc.nombreArchivo ?? "Documento";

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
    console.error("Error convirtiendo DOCX (orden del día):", error);
    return new NextResponse("Error al procesar el documento", { status: 500 });
  }
}
