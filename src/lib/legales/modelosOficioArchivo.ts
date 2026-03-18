import { randomBytes } from "crypto";
import { esWordModeloPermitido as esWordOk } from "@/lib/legales/modelosOficioWordShared";

export const MIME_WORD_DOC = "application/msword";
export const MIME_WORD_DOCX =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

/** .doc (binario antiguo), no .docx */
export function esWordDocBinario(nombreArchivo: string | null | undefined): boolean {
  const n = (nombreArchivo ?? "").toLowerCase();
  return n.endsWith(".doc") && !n.endsWith(".docx");
}

export function esWordModeloPermitido(fileName: string): boolean {
  return esWordOk(fileName);
}

export function extensionWordModelo(fileName: string): ".doc" | ".docx" {
  const n = fileName.toLowerCase();
  if (n.endsWith(".docx")) return ".docx";
  if (n.endsWith(".doc")) return ".doc";
  return ".docx";
}

/** `blobPrefix`: ej. `modelooficio` | `modelonota` */
export function generarNombreAlmacenamientoModeloWord(
  originalName: string,
  blobPrefix = "modelooficio"
): string {
  const ext = extensionWordModelo(originalName);
  return `${blobPrefix}_${Date.now()}_${randomBytes(4).toString("hex")}${ext}`;
}

export function contentTypeWordSubida(fileName: string, fileType: string): string {
  if (extensionWordModelo(fileName) === ".doc") {
    const t = (fileType || "").toLowerCase();
    if (t === MIME_WORD_DOC || t.includes("msword")) return MIME_WORD_DOC;
    return MIME_WORD_DOC;
  }
  const t = (fileType || "").toLowerCase();
  if (t === MIME_WORD_DOCX || t.includes("wordprocessingml")) return MIME_WORD_DOCX;
  return MIME_WORD_DOCX;
}

export function validarArchivoWordModelo(
  file: File | null,
  maxBytes: number
): { ok: true } | { ok: false; error: string } {
  if (!file || file.size === 0) {
    return { ok: false, error: "Debe seleccionar un archivo .doc o .docx" };
  }
  if (!esWordOk(file.name)) {
    return { ok: false, error: "Solo se permiten archivos .doc o .docx" };
  }
  if (file.size > maxBytes) {
    const mb = Math.round(maxBytes / (1024 * 1024));
    return { ok: false, error: `El archivo no puede superar ${mb} MB` };
  }
  return { ok: true };
}
