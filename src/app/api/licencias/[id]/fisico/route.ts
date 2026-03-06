import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { registrarAuditoria } from "@/lib/auditoria";
import { isSuperAdmin } from "@/lib/auth.utils";
import path from "path";
import { unlink } from "fs/promises";

/** DELETE - Eliminar físicamente una licencia y sus certificados (solo SUPER_ADMIN) */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const roles = (session?.user as { roles?: unknown })?.roles ?? [];
  let esSuperAdmin = isSuperAdmin(roles);
  const currentUserId = (session?.user as { id?: string })?.id;
  if (!esSuperAdmin && currentUserId) {
    const userRoles = await prisma.userRole.findMany({
      where: { userId: currentUserId },
      include: { role: true },
    });
    const roleNames = userRoles.map((ur) => ur.role.nombre);
    esSuperAdmin = roleNames.includes("SUPER_ADMIN");
  }
  if (!esSuperAdmin) {
    return NextResponse.json(
      { error: "Solo SUPER_ADMIN puede eliminar licencias de forma permanente." },
      { status: 403 }
    );
  }

  const id = parseInt((await params).id, 10);
  if (isNaN(id)) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }

  const licencia = await prisma.licencia.findUnique({
    where: { id },
    include: {
      certificados: { select: { id: true, urlArchivo: true } },
      legajo: { select: { numeroLegajo: true, apellidos: true, nombres: true } },
    },
  });

  if (!licencia) {
    return NextResponse.json({ error: "Licencia no encontrada" }, { status: 404 });
  }

  const urlsToDelete = licencia.certificados.map((c) => c.urlArchivo);
  const detalle = `Licencia #${id} - ${licencia.legajo.apellidos} ${licencia.legajo.nombres} (Leg. ${licencia.legajo.numeroLegajo})`;

  try {
    await prisma.$transaction([
      prisma.observacionLicencia.deleteMany({ where: { licenciaId: id } }),
      prisma.certificado.deleteMany({ where: { licenciaId: id } }),
      prisma.licencia.delete({ where: { id } }),
    ]);
  } catch (e) {
    console.error("[DELETE /api/licencias/[id]/fisico]", e);
    return NextResponse.json(
      { error: "Error al eliminar la licencia" },
      { status: 500 }
    );
  }

  for (const url of urlsToDelete) {
    if (url?.startsWith("/")) {
      try {
        const filePath = path.join(process.cwd(), url.replace(/^\//, ""));
        await unlink(filePath);
      } catch {
        // Ignorar si el archivo no existe
      }
    }
  }

  const sessionUser = session?.user as { id?: string; name?: string; email?: string };
  await registrarAuditoria({
    userId: sessionUser?.id ?? "",
    userNombre: sessionUser?.name ?? "",
    userEmail: sessionUser?.email ?? "",
    accion: "Eliminó físicamente la licencia",
    modulo: "Licencias",
    detalle,
    ip: undefined,
  });

  return NextResponse.json({ success: true });
}
