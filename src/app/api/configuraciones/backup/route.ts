import { NextResponse } from "next/server";
import { PassThrough } from "stream";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { registrarAuditoria } from "@/lib/auditoria";
import archiver from "archiver";

/** Claves del JSON en backup.json (deben coincidir con restore). */
const BACKUP_KEYS = [
  "roles",
  "permissions",
  "legajos",
  "users",
  "user_roles",
  "user_permissions",
  "contactos_adicionales",
  "telefonos_contacto",
  "configuracion_vacaciones",
  "solicitud_vacaciones",
  "licencias",
  "observaciones_licencia",
  "certificados",
  "notificaciones",
  "auditoria_logs",
  "tipos_nota",
  "modelos_nota",
  "actas",
  "categorias_legislacion",
  "documentos_legislacion",
] as const;

function nombreZip() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const h = String(now.getHours()).padStart(2, "0");
  const min = String(now.getMinutes()).padStart(2, "0");
  const s = String(now.getSeconds()).padStart(2, "0");
  return `backup_${y}${m}${d}_${h}${min}${s}.zip`;
}

export async function POST() {
  const session = await auth();
  const roles = (session?.user as { roles?: string[] })?.roles ?? [];
  if (!roles.includes("ADMIN")) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const fetchers: Record<(typeof BACKUP_KEYS)[number], () => Promise<unknown[]>> = {
    roles: () => prisma.role.findMany(),
    permissions: () => prisma.permission.findMany(),
    legajos: () => prisma.legajo.findMany(),
    users: () => prisma.user.findMany(),
    user_roles: () => prisma.userRole.findMany(),
    user_permissions: () => prisma.userPermission.findMany(),
    contactos_adicionales: () => prisma.contactoAdicional.findMany(),
    telefonos_contacto: () => prisma.telefonoContacto.findMany(),
    configuracion_vacaciones: () => prisma.configuracionVacaciones.findMany(),
    solicitud_vacaciones: () => prisma.solicitudVacaciones.findMany(),
    licencias: () => prisma.licencia.findMany(),
    observaciones_licencia: () => prisma.observacionLicencia.findMany(),
    certificados: () => prisma.certificado.findMany(),
    notificaciones: () => prisma.notificacion.findMany(),
    auditoria_logs: () => prisma.auditoriaLog.findMany(),
    tipos_nota: () => prisma.tipoNota.findMany(),
    modelos_nota: () => prisma.modeloNota.findMany(),
    actas: () => prisma.acta.findMany(),
    categorias_legislacion: () => prisma.categoriaLegislacion.findMany(),
    documentos_legislacion: () => prisma.documentoLegislacion.findMany(),
  };

  const tablas: Record<string, unknown[]> = {};
  for (const key of BACKUP_KEYS) {
    tablas[key] = await fetchers[key]();
  }

  const backup = {
    generadoEn: new Date().toISOString(),
    version: "1.0",
    tablas,
  };

  const filename = nombreZip();
  const archive = archiver("zip", { zlib: { level: 9 } });
  const pass = new PassThrough();
  const chunks: Buffer[] = [];
  pass.on("data", (c: Buffer) => chunks.push(c));

  await new Promise<void>((resolve, reject) => {
    pass.on("end", () => resolve());
    pass.on("error", reject);
    archive.on("error", reject);
    archive.pipe(pass);
    archive.append(JSON.stringify(backup, null, 2), { name: "backup.json" });
    archive.finalize();
  });

  const buffer = Buffer.concat(chunks);

  const user = session?.user as { id?: string; name?: string; email?: string };
  try {
    await registrarAuditoria({
      userId: user?.id ?? "",
      userNombre: user?.name ?? "",
      userEmail: user?.email ?? "",
      accion: "Generó un backup",
      modulo: "Configuraciones",
      detalle: filename,
    });
  } catch {}

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
