import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { registrarAuditoria } from "@/lib/auditoria";
import { subirArchivo, eliminarArchivo } from "@/lib/blob";
import path from "path";
import {
  validarArchivoWordModelo,
  generarNombreAlmacenamientoModeloWord,
  contentTypeWordSubida,
} from "@/lib/legales/modelosOficioArchivo";
import { unlink } from "fs/promises";
import { parsearFechaSegura } from "@/lib/utils/fecha";

const ROLES = ["ADMIN", "SECRETARIA"] as const;
const MAX_FILE_SIZE = 10 * 1024 * 1024;
function canAccess(roles: string[]) {
  return ROLES.some((r) => roles.includes(r));
}

function parseId(id: string): number | null {
  const n = parseInt(id, 10);
  return isNaN(n) ? null : n;
}

/** GET - Obtener un acta por ID */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const roles = (session?.user as { roles?: string[] })?.roles ?? [];
  if (!canAccess(roles)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const id = parseId((await params).id);
  if (id === null) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }

  const acta = await prisma.acta.findUnique({ where: { id } });
  if (!acta) {
    return NextResponse.json({ error: "Acta no encontrada" }, { status: 404 });
  }

  return NextResponse.json(acta);
}

/** PUT - Actualizar acta (titulo, fechaActa, quitar archivo o reemplazar) */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const roles = (session?.user as { roles?: string[] })?.roles ?? [];
  if (!canAccess(roles)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const id = parseId((await params).id);
  if (id === null) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }

  const acta = await prisma.acta.findUnique({ where: { id } });
  if (!acta) {
    return NextResponse.json({ error: "Acta no encontrada" }, { status: 404 });
  }

  const contentType = req.headers.get("content-type") ?? "";
  if (!contentType.includes("multipart/form-data")) {
    return NextResponse.json(
      { error: "Se requiere multipart/form-data" },
      { status: 400 }
    );
  }

  try {
    const formData = await req.formData();
    const titulo = (formData.get("titulo") as string)?.trim();
    const fechaActaStr = (formData.get("fechaActa") as string)?.trim();
    const quitarArchivo =
      formData.get("quitarArchivo") === "true" ||
      formData.get("quitarArchivo") === "1";
    const file = formData.get("file") as File | null;

    const data: {
      titulo?: string;
      fechaActa?: Date;
      nombreArchivo?: string | null;
      urlArchivo?: string | null;
    } = {};

    if (titulo !== undefined) data.titulo = titulo;
    const fechaActa = parsearFechaSegura(fechaActaStr ?? "");
    if (fechaActa) data.fechaActa = fechaActa;

    if (quitarArchivo && acta.urlArchivo) {
      await eliminarArchivo(acta.urlArchivo);
      if (acta.urlArchivo.startsWith("/")) {
        try {
          await unlink(path.join(process.cwd(), "public", acta.urlArchivo));
        } catch {}
      }
      data.nombreArchivo = null;
      data.urlArchivo = null;
    }

    if (file && file.size > 0) {
      const v = validarArchivoWordModelo(file, MAX_FILE_SIZE);
      if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });
      if (acta.urlArchivo) {
        await eliminarArchivo(acta.urlArchivo);
        if (acta.urlArchivo.startsWith("/")) {
          try {
            await unlink(path.join(process.cwd(), "public", acta.urlArchivo));
          } catch {}
        }
      }
      const safeName = generarNombreAlmacenamientoModeloWord(file.name, "acta");
      const mime = contentTypeWordSubida(file.name, file.type);
      data.urlArchivo = await subirArchivo("actas", safeName, file, mime);
      data.nombreArchivo = file.name;
    }

    const updated = await prisma.acta.update({
      where: { id },
      data,
    });

    const user = session?.user as {
      id?: string;
      name?: string;
      email?: string;
    };
    await registrarAuditoria({
      userId: user?.id ?? "",
      userNombre: user?.name ?? "",
      userEmail: user?.email ?? "",
      accion: "Editó un acta",
      modulo: "Secretaría",
      ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? undefined,
    });

    return NextResponse.json(updated);
  } catch (e) {
    console.error("Error actualizando acta:", e);
    return NextResponse.json(
      { error: "Error al actualizar el acta" },
      { status: 500 }
    );
  }
}

/** DELETE - Eliminar acta y archivo físico si existe */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const roles = (session?.user as { roles?: string[] })?.roles ?? [];
  if (!canAccess(roles)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const id = parseId((await params).id);
  if (id === null) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }

  const acta = await prisma.acta.findUnique({ where: { id } });
  if (!acta) {
    return NextResponse.json({ error: "Acta no encontrada" }, { status: 404 });
  }

  if (acta.urlArchivo) {
    await eliminarArchivo(acta.urlArchivo);
    if (acta.urlArchivo.startsWith("/")) {
      try {
        await unlink(path.join(process.cwd(), "public", acta.urlArchivo));
      } catch {}
    }
  }

  await prisma.acta.delete({ where: { id } });

  const user = session?.user as {
    id?: string;
    name?: string;
    email?: string;
  };
  await registrarAuditoria({
    userId: user?.id ?? "",
    userNombre: user?.name ?? "",
    userEmail: user?.email ?? "",
    accion: "Eliminó un acta",
    modulo: "Secretaría",
    ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? undefined,
  });

  return NextResponse.json({ success: true });
}
