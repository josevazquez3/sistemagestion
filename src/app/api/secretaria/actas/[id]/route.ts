import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { registrarAuditoria } from "@/lib/auditoria";
import { writeFile, mkdir, unlink } from "fs/promises";
import path from "path";
import { randomBytes } from "crypto";

const ROLES = ["ADMIN", "SECRETARIA"] as const;
const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "actas");

function canAccess(roles: string[]) {
  return ROLES.some((r) => roles.includes(r));
}

function parseId(id: string): number | null {
  const n = parseInt(id, 10);
  return isNaN(n) ? null : n;
}

function parseFechaArgentina(str: string): Date | null {
  if (!str) return null;
  const [d, m, y] = str.split("/").map((x) => parseInt(x, 10));
  if (!d || !m || !y) return null;
  const date = new Date(y, m - 1, d);
  if (isNaN(date.getTime())) return null;
  return date;
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
    const fechaActa = parseFechaArgentina(fechaActaStr ?? "");
    if (fechaActa) data.fechaActa = fechaActa;

    if (quitarArchivo && acta.urlArchivo) {
      const filePath = path.join(process.cwd(), "public", acta.urlArchivo);
      try {
        await unlink(filePath);
      } catch {
        // ignorar si no existe
      }
      data.nombreArchivo = null;
      data.urlArchivo = null;
    }

    if (file && file.size > 0) {
      const name = file.name.toLowerCase();
      if (!name.endsWith(".docx")) {
        return NextResponse.json(
          { error: "Solo se permiten archivos .docx" },
          { status: 400 }
        );
      }
      const ct = file.type?.toLowerCase() ?? "";
      const validMime =
        ct === DOCX_MIME || ct === "application/octet-stream" || ct === "";
      if (!validMime) {
        return NextResponse.json(
          { error: "Tipo de archivo no válido. Debe ser .docx" },
          { status: 400 }
        );
      }
      if (file.size > MAX_FILE_SIZE) {
        return NextResponse.json(
          { error: "El archivo no puede superar 10 MB" },
          { status: 400 }
        );
      }
      if (acta.urlArchivo) {
        const oldPath = path.join(process.cwd(), "public", acta.urlArchivo);
        try {
          await unlink(oldPath);
        } catch {
          // ignorar
        }
      }
      await mkdir(UPLOAD_DIR, { recursive: true });
      const timestamp = Date.now();
      const random = randomBytes(4).toString("hex");
      const safeName = `acta_${timestamp}_${random}.docx`;
      const filePath = path.join(UPLOAD_DIR, safeName);
      const buffer = Buffer.from(await file.arrayBuffer());
      await writeFile(filePath, buffer);
      data.nombreArchivo = file.name;
      data.urlArchivo = `/uploads/actas/${safeName}`;
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
    const filePath = path.join(process.cwd(), "public", acta.urlArchivo);
    try {
      await unlink(filePath);
    } catch {
      // ignorar si no existe
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
