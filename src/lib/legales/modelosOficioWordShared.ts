/** Utilidades sin dependencias de Node (seguras para importar en el cliente). */

export function esWordModeloPermitido(fileName: string): boolean {
  const n = fileName.trim().toLowerCase();
  return n.endsWith(".docx") || n.endsWith(".doc");
}

export function quitarExtensionWord(name: string): string {
  return name.replace(/\.(docx|doc)$/i, "") || name;
}

export function etiquetaTipoWord(nombreArchivo: string): "DOC" | "DOCX" {
  return nombreArchivo.toLowerCase().endsWith(".docx") ? "DOCX" : "DOC";
}

/** .doc binario (Word antiguo), excluye .docx */
export function esDocFormatoAntiguo(nombreArchivo: string | null | undefined): boolean {
  const n = (nombreArchivo ?? "").trim().toLowerCase();
  return n.endsWith(".doc") && !n.endsWith(".docx");
}
