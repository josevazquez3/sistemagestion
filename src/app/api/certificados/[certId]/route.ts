import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { registrarAuditoria } from "@/lib/auditoria";
import { unlink } from "fs/promises";
import path from "path";

const ROLES_LICENCIAS = ["ADMIN", "RRHH"] as const;

function canManageLicencias(roles: string[]) {
  return ROLES_LICENCIAS.some((r) => roles.includes(r));
}

/** DELETE - Eliminar un certificado (archivo físico + registro en BD) */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ certId: string }> }
) {
  const session = await auth();
  const roles = (session?.user as { roles?: string[] })?.roles ?? [];
  if (!canManageLicencias(roles)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const certId = parseInt((await params).certId, 10);
  if (isNaN(certId)) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

  const cert = await prisma.certificado.findUnique({ where: { id: certId } });
  if (!cert) return NextResponse.json({ error: "Certificado no encontrado" }, { status: 404 });

  const urlArchivo = cert.urlArchivo;
  if (urlArchivo.startsWith("/")) {
    const filePath = path.join(process.cwd(), "public", urlArchivo);
    try {
      await unlink(filePath);
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "ENOENT") {
        console.error("Error eliminando archivo certificado:", e);
      }
    }
  }

  await prisma.certificado.delete({ where: { id: certId } });

  const user = session?.user as { id?: string; name?: string; email?: string };
  try {
    await registrarAuditoria({
      userId: user?.id ?? "",
      userNombre: user?.name ?? "",
      userEmail: user?.email ?? "",
      accion: "Eliminó un certificado",
      modulo: "Licencias",
      detalle: `Certificado ID ${certId}`,
      ip: _req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? undefined,
    });
  } catch {}

  return NextResponse.json({ success: true });
}
