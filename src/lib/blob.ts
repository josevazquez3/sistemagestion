import { put, del } from "@vercel/blob";

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
