import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { esBlobUrl, servirBlobDesdeApi } from "@/lib/blob";
import { readFile } from "fs/promises";
import path from "path";

const ROLES_LICENCIAS = ["ADMIN", "RRHH"] as const;

function canManageLicencias(roles: string[]) {
  return ROLES_LICENCIAS.some((r) => roles.includes(r));
}

/** GET - Descargar archivo del certificado (mismo origen, sin exponer URL de Blob) */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ certId: string }> }
) {
  const session = await auth();
  const roles = (session?.user as { roles?: string[] })?.roles ?? [];
  if (!canManageLicencias(roles)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const certId = parseInt((await params).certId, 10);
  if (isNaN(certId)) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }

  const cert = await prisma.certificado.findUnique({ where: { id: certId } });
  if (!cert) {
    return NextResponse.json({ error: "Certificado no encontrado" }, { status: 404 });
  }

  if (!cert.urlArchivo) {
    return NextResponse.json(
      { error: "Este certificado no tiene archivo" },
      { status: 404 }
    );
  }

  if (esBlobUrl(cert.urlArchivo)) {
    const contentType =
      cert.tipoArchivo === "PDF"
        ? "application/pdf"
        : "image/jpeg";
    return servirBlobDesdeApi(
      cert.urlArchivo,
      cert.nombreArchivo ?? "certificado",
      contentType,
      false
    );
  }

  const filePath = path.join(process.cwd(), "public", cert.urlArchivo.replace(/^\//, ""));
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
    cert.tipoArchivo === "PDF"
      ? "application/pdf"
      : "image/jpeg";
  const filename = cert.nombreArchivo ?? "certificado";

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="${encodeURIComponent(filename)}"`,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
