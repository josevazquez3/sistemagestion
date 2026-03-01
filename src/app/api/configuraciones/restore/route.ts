import { NextResponse } from "next/server";
import AdmZip from "adm-zip";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { registrarAuditoria } from "@/lib/auditoria";

const VERSION = "1.0";

/** Campos que pueden venir como string ISO y deben convertirse a Date */
const CAMPOS_FECHA = [
  "creadoEn",
  "actualizadoEn",
  "fechaAlta",
  "fechaBaja",
  "fechaInicio",
  "fechaFin",
  "fechaCierre",
  "fechaCarga",
  "fechaActa",
  "fechaDocumento",
  "deletedAt",
  "createdAt",
  "updatedAt",
];

function transformarFila(key: string, row: Record<string, unknown>): Record<string, unknown> {
  const resultado = { ...row };
  for (const campo of CAMPOS_FECHA) {
    const val = resultado[campo];
    if (val != null && typeof val === "string") {
      resultado[campo] = new Date(val);
    }
  }
  if (key === "modelos_nota" && resultado.contenido != null && typeof resultado.contenido === "object") {
    const c = resultado.contenido as { type?: string; data?: number[] };
    if (c.type === "Buffer" && Array.isArray(c.data)) {
      resultado.contenido = Buffer.from(c.data);
    }
  }
  return resultado;
}

/** Orden de inserción: padres antes que dependientes (respeta FKs). modelos_nota depende de tipos_nota. */
const INSERT_ORDER = [
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

/** Orden de eliminación: dependientes antes que padres. */
const DELETE_ORDER = [
  "documentos_legislacion",
  "categorias_legislacion",
  "actas",
  "modelos_nota",
  "tipos_nota",
  "auditoria_logs",
  "observaciones_licencia",
  "certificados",
  "licencias",
  "notificaciones",
  "solicitud_vacaciones",
  "configuracion_vacaciones",
  "telefonos_contacto",
  "contactos_adicionales",
  "user_roles",
  "user_permissions",
  "users",
  "legajos",
  "roles",
  "permissions",
] as const;

type Delegate = {
  deleteMany: () => Promise<unknown>;
  createMany: (args: { data: unknown[]; skipDuplicates?: boolean }) => Promise<unknown>;
};

const PRISMA_DELEGATES: Record<string, Delegate> = {
  roles: prisma.role as unknown as Delegate,
  permissions: prisma.permission as unknown as Delegate,
  legajos: prisma.legajo as unknown as Delegate,
  users: prisma.user as unknown as Delegate,
  user_roles: prisma.userRole as unknown as Delegate,
  user_permissions: prisma.userPermission as unknown as Delegate,
  contactos_adicionales: prisma.contactoAdicional as unknown as Delegate,
  telefonos_contacto: prisma.telefonoContacto as unknown as Delegate,
  configuracion_vacaciones: prisma.configuracionVacaciones as unknown as Delegate,
  solicitud_vacaciones: prisma.solicitudVacaciones as unknown as Delegate,
  licencias: prisma.licencia as unknown as Delegate,
  observaciones_licencia: prisma.observacionLicencia as unknown as Delegate,
  certificados: prisma.certificado as unknown as Delegate,
  notificaciones: prisma.notificacion as unknown as Delegate,
  auditoria_logs: prisma.auditoriaLog as unknown as Delegate,
  tipos_nota: prisma.tipoNota as unknown as Delegate,
  modelos_nota: prisma.modeloNota as unknown as Delegate,
  actas: prisma.acta as unknown as Delegate,
  categorias_legislacion: prisma.categoriaLegislacion as unknown as Delegate,
  documentos_legislacion: prisma.documentoLegislacion as unknown as Delegate,
};

/** Compatibilidad con backups antiguos que usaban "usuarios" en lugar de "users". */
function getTabla(tablas: Record<string, unknown[]>, key: string): unknown[] | undefined {
  if (key === "users") {
    return tablas["users"] ?? tablas["usuarios"];
  }
  return tablas[key];
}

export async function POST(request: Request) {
  const session = await auth();
  const roles = (session?.user as { roles?: string[] })?.roles ?? [];
  if (!roles.includes("ADMIN")) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  let file: File;
  try {
    const formData = await request.formData();
    file = formData.get("file") as File;
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ ok: false, error: "Falta el archivo .zip" }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ ok: false, error: "Error al leer el formulario" }, { status: 400 });
  }

  let backup: { version?: string; tablas?: Record<string, unknown[]> };
  try {
    const buf = Buffer.from(await file.arrayBuffer());
    const zip = new AdmZip(buf);
    const entry = zip.getEntry("backup.json");
    if (!entry || entry.isDirectory) {
      return NextResponse.json({ ok: false, error: "El zip no contiene backup.json" }, { status: 400 });
    }
    const raw = entry.getData().toString("utf8");
    backup = JSON.parse(raw) as { version?: string; tablas?: Record<string, unknown[]> };
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: "Archivo inválido o no es un backup válido." },
      { status: 400 }
    );
  }

  if (backup.version !== VERSION) {
    return NextResponse.json(
      { ok: false, error: "Formato de backup no soportado (version incorrecta)." },
      { status: 400 }
    );
  }

  const tablas = backup.tablas ?? {};

  try {
    for (const key of DELETE_ORDER) {
      const delegate = PRISMA_DELEGATES[key];
      if (delegate) await delegate.deleteMany();
    }
    for (const key of INSERT_ORDER) {
      const rows = getTabla(tablas, key);
      const delegate = PRISMA_DELEGATES[key];
      if (!delegate || !Array.isArray(rows) || rows.length === 0) continue;
      const rowsTransformadas = rows.map((r) => transformarFila(key, r as Record<string, unknown>));
      await delegate.createMany({ data: rowsTransformadas, skipDuplicates: true });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error al restaurar";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }

  const user = session?.user as { id?: string; name?: string; email?: string };
  try {
    await registrarAuditoria({
      userId: user?.id ?? "",
      userNombre: user?.name ?? "",
      userEmail: user?.email ?? "",
      accion: "Restauró un backup",
      modulo: "Configuraciones",
    });
  } catch {}

  return NextResponse.json({ ok: true, mensaje: "Backup restaurado correctamente" });
}
