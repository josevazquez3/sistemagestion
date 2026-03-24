"use server";

import { randomBytes } from "crypto";
import { put } from "@vercel/blob";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { eliminarArchivo, sanitizarNombreArchivo } from "@/lib/blob";
import { registrarAuditoria } from "@/lib/auditoria";
import type { Prisma } from "@prisma/client";
import { parsearFechaSegura } from "@/lib/utils/fecha";
import { ensureLegalHistorialTsdTable } from "@/lib/legales/ensureLegalHistorialTsdTable";

const ROLES = new Set(["SUPER_ADMIN", "ADMIN", "LEGALES"]);
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const PDF_MIME = "application/pdf";
const DOC_MIME = "application/msword";
const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const DETALLE_MAX = 500;

type CtxAuditoria = {
  userId: string;
  userNombre: string;
  userEmail: string;
  ip?: string;
};

function truncarDetalle(s: string): string {
  const t = s.trim();
  return t.length <= DETALLE_MAX ? t : `${t.slice(0, DETALLE_MAX)}…`;
}

async function requireHistorialTsdAccess(): Promise<CtxAuditoria> {
  const session = await auth();
  const roles = (session?.user as { roles?: string[] })?.roles ?? [];
  if (!roles.some((r) => ROLES.has(r))) {
    throw new Error("No autorizado");
  }
  await ensureLegalHistorialTsdTable();
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? undefined;
  const user = session?.user as { id?: string; name?: string; email?: string };
  return {
    userId: user?.id ?? "",
    userNombre: user?.name ?? "",
    userEmail: user?.email ?? "",
    ip,
  };
}

function extensionDesdeNombre(name: string): string {
  const n = name.toLowerCase();
  if (n.endsWith(".docx")) return ".docx";
  if (n.endsWith(".doc")) return ".doc";
  if (n.endsWith(".pdf")) return ".pdf";
  return ".pdf";
}

function mimePorExtension(ext: string): string {
  if (ext === ".docx") return DOCX_MIME;
  if (ext === ".doc") return DOC_MIME;
  return PDF_MIME;
}

function validarArchivoOpcional(file: File): void {
  if (file.size > MAX_FILE_SIZE) {
    throw new Error("El archivo no puede superar 10 MB");
  }
  const name = file.name.toLowerCase();
  const extOk = name.endsWith(".pdf") || name.endsWith(".doc") || name.endsWith(".docx");
  if (!extOk) {
    throw new Error("Solo se permiten archivos PDF, DOC o DOCX");
  }
  const ct = (file.type ?? "").toLowerCase();
  const validMime =
    ct === "" ||
    ct === PDF_MIME ||
    ct === DOC_MIME ||
    ct === DOCX_MIME ||
    ct === "application/octet-stream";
  if (!validMime) {
    throw new Error("Tipo de archivo no válido");
  }
}

async function subirArchivoSiHay(
  file: File | null | undefined
): Promise<{
  archivoNombre: string | null;
  archivoUrl: string | null;
  archivoKey: string | null;
}> {
  if (!file || file.size === 0) {
    return { archivoNombre: null, archivoUrl: null, archivoKey: null };
  }
  validarArchivoOpcional(file);
  const ext = extensionDesdeNombre(file.name);
  const timestamp = Date.now();
  const random = randomBytes(4).toString("hex");
  const base = `tsd_${timestamp}_${random}${ext}`;
  const pathnameKey = `historial-tsd/${sanitizarNombreArchivo(base)}`;
  const mime = file.type || mimePorExtension(ext);
  const result = await put(pathnameKey, file, {
    access: "public",
    contentType: mime,
  });
  return {
    archivoNombre: file.name,
    archivoUrl: result.url,
    archivoKey: result.pathname,
  };
}

async function crearRegistroCore(
  titulo: string,
  fechaOficio: Date,
  arch: {
    archivoNombre: string | null;
    archivoUrl: string | null;
    archivoKey: string | null;
  }
): Promise<void> {
  await prisma.legalHistorialTsd.create({
    data: {
      titulo: titulo.trim(),
      fechaOficio,
      archivoNombre: arch.archivoNombre,
      archivoUrl: arch.archivoUrl,
      archivoKey: arch.archivoKey,
    },
  });
}

export async function getHistorialTsd(filters?: {
  search?: string;
  desde?: Date;
  hasta?: Date;
}): Promise<
  {
    id: number;
    titulo: string;
    fechaOficio: Date;
    archivoNombre: string | null;
    archivoUrl: string | null;
    archivoKey: string | null;
    fechaCarga: Date;
    actualizadoEn: Date;
  }[]
> {
  await requireHistorialTsdAccess();
  const where: Prisma.LegalHistorialTsdWhereInput = {};
  const q = filters?.search?.trim();
  if (q) {
    where.OR = [
      { titulo: { contains: q, mode: "insensitive" } },
      { archivoNombre: { contains: q, mode: "insensitive" } },
    ];
  }
  const rango: { gte?: Date; lte?: Date } = {};
  if (filters?.desde) rango.gte = filters.desde;
  if (filters?.hasta) rango.lte = filters.hasta;
  if (rango.gte !== undefined || rango.lte !== undefined) {
    where.fechaOficio = rango;
  }
  return prisma.legalHistorialTsd.findMany({
    where,
    orderBy: { fechaCarga: "desc" },
  });
}

export async function createHistorialTsd(data: {
  titulo: string;
  fechaOficio: Date;
  archivo?: File | null;
}): Promise<{ error?: string }> {
  try {
    const ctx = await requireHistorialTsdAccess();
    const titulo = data.titulo?.trim() ?? "";
    if (!titulo) {
      return { error: "El título es obligatorio" };
    }
    const fecha =
      data.fechaOficio instanceof Date && !isNaN(data.fechaOficio.getTime())
        ? data.fechaOficio
        : null;
    if (!fecha) {
      return { error: "La fecha de la sentencia es obligatoria" };
    }
    const arch = await subirArchivoSiHay(data.archivo);
    await crearRegistroCore(titulo, fecha, arch);
    await registrarAuditoria({
      userId: ctx.userId,
      userNombre: ctx.userNombre,
      userEmail: ctx.userEmail,
      accion: "Creó un registro en historial Exptes. TSD",
      modulo: "Legales",
      detalle: truncarDetalle(`Título: ${titulo}`),
      ip: ctx.ip,
    });
    revalidatePath("/legales/historial-tsd");
    return {};
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error al crear el registro";
    return { error: msg };
  }
}

/** Fecha en DD/MM/YYYY (misma convención que Historial de Oficios). */
export async function createHistorialTsdDesdeForm(data: {
  titulo: string;
  fechaOficioStr: string;
  archivo?: File | null;
}): Promise<{ error?: string }> {
  const fecha = parsearFechaSegura(data.fechaOficioStr?.trim() ?? "");
  if (!fecha) {
    return { error: "La fecha de la sentencia es obligatoria (formato DD/MM/YYYY)" };
  }
  return createHistorialTsd({
    titulo: data.titulo,
    fechaOficio: fecha,
    archivo: data.archivo,
  });
}

export async function updateHistorialTsd(
  id: number,
  data: {
    titulo: string;
    fechaOficioStr: string;
    archivo?: File | null;
    quitarArchivo?: boolean;
  }
): Promise<{ error?: string }> {
  try {
    const ctx = await requireHistorialTsdAccess();
    const existente = await prisma.legalHistorialTsd.findUnique({ where: { id } });
    if (!existente) {
      return { error: "Registro no encontrado" };
    }
    const titulo = data.titulo?.trim() ?? "";
    if (!titulo) {
      return { error: "El título es obligatorio" };
    }
    const fecha = parsearFechaSegura(data.fechaOficioStr?.trim() ?? "");
    if (!fecha) {
      return { error: "La fecha de la sentencia es obligatoria (DD/MM/YYYY)" };
    }

    let archivoNombre = existente.archivoNombre;
    let archivoUrl = existente.archivoUrl;
    let archivoKey = existente.archivoKey;

    if (data.quitarArchivo && existente.archivoUrl) {
      await eliminarArchivo(existente.archivoUrl);
      archivoNombre = null;
      archivoUrl = null;
      archivoKey = null;
    }

    if (data.archivo && data.archivo.size > 0) {
      if (archivoUrl) {
        await eliminarArchivo(archivoUrl);
      }
      const arch = await subirArchivoSiHay(data.archivo);
      archivoNombre = arch.archivoNombre;
      archivoUrl = arch.archivoUrl;
      archivoKey = arch.archivoKey;
    }

    await prisma.legalHistorialTsd.update({
      where: { id },
      data: {
        titulo,
        fechaOficio: fecha,
        archivoNombre,
        archivoUrl,
        archivoKey,
      },
    });
    await registrarAuditoria({
      userId: ctx.userId,
      userNombre: ctx.userNombre,
      userEmail: ctx.userEmail,
      accion: "Editó un registro en historial Exptes. TSD",
      modulo: "Legales",
      detalle: truncarDetalle(`ID ${id} — ${titulo}`),
      ip: ctx.ip,
    });
    revalidatePath("/legales/historial-tsd");
    return {};
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error al actualizar";
    return { error: msg };
  }
}

export async function deleteHistorialTsd(id: number): Promise<{ error?: string }> {
  try {
    const ctx = await requireHistorialTsdAccess();
    const row = await prisma.legalHistorialTsd.findUnique({ where: { id } });
    if (!row) {
      return { error: "Registro no encontrado" };
    }
    if (row.archivoUrl) {
      await eliminarArchivo(row.archivoUrl);
    }
    await prisma.legalHistorialTsd.delete({ where: { id } });
    await registrarAuditoria({
      userId: ctx.userId,
      userNombre: ctx.userNombre,
      userEmail: ctx.userEmail,
      accion: "Eliminó un registro en historial Exptes. TSD",
      modulo: "Legales",
      detalle: truncarDetalle(`ID ${id} — ${row.titulo}`),
      ip: ctx.ip,
    });
    revalidatePath("/legales/historial-tsd");
    return {};
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error al eliminar";
    return { error: msg };
  }
}

export type HistorialTsdMasivoResultado = {
  ok: number;
  fallidos: { titulo: string; error: string }[];
};

export async function createHistorialTsdMasivo(
  items: { titulo: string; fechaOficioStr: string; archivo: File }[]
): Promise<HistorialTsdMasivoResultado> {
  const ctx = await requireHistorialTsdAccess();
  const outcomes = await Promise.all(
    items.map(async (item) => {
      try {
        const titulo = item.titulo?.trim() ?? "";
        if (!titulo) {
          return {
            ok: false as const,
            titulo: item.titulo || "(sin título)",
            error: "Título obligatorio",
          };
        }
        const fecha = parsearFechaSegura(item.fechaOficioStr?.trim() ?? "");
        if (!fecha) {
          return {
            ok: false as const,
            titulo,
            error: "Fecha inválida",
          };
        }
        if (!item.archivo || item.archivo.size === 0) {
          return { ok: false as const, titulo, error: "Archivo obligatorio" };
        }
        const arch = await subirArchivoSiHay(item.archivo);
        await crearRegistroCore(titulo, fecha, arch);
        return { ok: true as const, titulo };
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Error";
        return {
          ok: false as const,
          titulo: item.titulo?.trim() || item.archivo?.name || "(entrada)",
          error: msg,
        };
      }
    })
  );

  revalidatePath("/legales/historial-tsd");

  const ok = outcomes.filter((o): o is { ok: true; titulo: string } => o.ok === true).length;
  const fallidos = outcomes
    .filter((o): o is { ok: false; titulo: string; error: string } => o.ok === false)
    .map((o) => ({ titulo: o.titulo, error: o.error }));

  if (ok > 0) {
    await registrarAuditoria({
      userId: ctx.userId,
      userNombre: ctx.userNombre,
      userEmail: ctx.userEmail,
      accion: `Cargó ${ok} registro${ok === 1 ? "" : "s"} de historial Exptes. TSD de forma masiva`,
      modulo: "Legales",
      detalle:
        fallidos.length > 0
          ? truncarDetalle(
              `Exitosos: ${ok}. Fallidos: ${fallidos.map((f) => f.titulo).join(", ")}`
            )
          : undefined,
      ip: ctx.ip,
    });
  }

  return { ok, fallidos };
}
