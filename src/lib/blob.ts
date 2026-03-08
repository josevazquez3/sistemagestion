import { put, del } from "@vercel/blob";
import { NextResponse } from "next/server";

/**
 * Sanitiza el nombre de archivo para evitar caracteres que Chrome bloquea en descargas.
 * Quita acentos, espacios y caracteres especiales.
 */
export function sanitizarNombreArchivo(nombre: string): string {
  return nombre
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // quitar acentos
    .replace(/\s+/g, "_") // espacios → guiones bajos
    .replace(/[()[\]{}]/g, "") // quitar paréntesis y corchetes
    .replace(/[^a-zA-Z0-9._-]/g, "_") // otros caracteres → _
    .replace(/_+/g, "_") // múltiples _ → uno solo
    .toLowerCase();
}

/**
 * Descarga el archivo desde una URL de Vercel Blob y devuelve una Response
 * servida desde la API (mismo origen) para evitar el aviso de Chrome
 * "Se bloqueó una descarga no segura".
 */
export async function servirBlobDesdeApi(
  urlArchivo: string,
  nombreArchivo: string,
  contentType: string,
  inline: boolean
): Promise<NextResponse> {
  const response = await fetch(urlArchivo);
  if (!response.ok) {
    return NextResponse.json(
      { error: "Archivo no encontrado" },
      { status: 404 }
    );
  }
  const buffer = await response.arrayBuffer();
  const contentTypeFinal =
    response.headers.get("content-type") ?? contentType;
  const nombreSeguro = encodeURIComponent(nombreArchivo)
    .replace(/'/g, "%27")
    .replace(/\(/g, "%28")
    .replace(/\)/g, "%29");
  const disposition = inline
    ? `inline; filename="${nombreSeguro}"; filename*=UTF-8''${nombreSeguro}`
    : `attachment; filename="${nombreSeguro}"; filename*=UTF-8''${nombreSeguro}`;

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": contentTypeFinal,
      "Content-Disposition": disposition,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

/**
 * Sube un archivo a Vercel Blob
 * @param carpeta - prefijo/carpeta ej: "legajos", "certificados"
 * @param nombreUnico - nombre del archivo ej: "foto_123.jpg"
 * @param file - File o Buffer
 * @param contentType - MIME type
 * @returns URL pública del archivo
 */
export async function subirArchivo(
  carpeta: string,
  nombreUnico: string,
  file: File | Buffer | ArrayBuffer,
  contentType: string
): Promise<string> {
  const { url } = await put(`${carpeta}/${nombreUnico}`, file, {
    access: "public",
    contentType,
  });
  return url;
}

/**
 * Elimina un archivo de Vercel Blob
 * @param url - URL completa del blob a eliminar
 */
export async function eliminarArchivo(url: string): Promise<void> {
  if (!url) return;
  // Solo eliminar si es URL de Vercel Blob (no ruta local legacy)
  if (url.startsWith("https://") && url.includes("blob.vercel-storage.com")) {
    await del(url);
  }
}

/**
 * Devuelve true si la URL es de Vercel Blob
 */
export function esBlobUrl(url: string): boolean {
  return Boolean(url?.startsWith("https://") && url.includes("blob.vercel-storage.com"));
}
