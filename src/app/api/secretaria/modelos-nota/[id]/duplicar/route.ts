import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { registrarAuditoria } from "@/lib/auditoria";
import { subirArchivo } from "@/lib/blob";

const ROLES = ["ADMIN", "SECRETARIA"] as const;

function canAccess(roles: string[]) {
  return ROLES.some((r) => roles.includes(r));
}

function parseId(id: string): number | null {
  const n = parseInt(id, 10);
  return isNaN(n) ? null : n;
}

export async function POST(
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

  let body: { nombre?: string; tipoNotaId?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
  }

  const nombre = (body.nombre ?? "").trim();
  if (!nombre) {
    return NextResponse.json({ error: "El nombre es requerido" }, { status: 400 });
  }

  const origen = await prisma.modeloNota.findUnique({ where: { id } });
  if (!origen) {
    return NextResponse.json({ error: "Modelo no encontrado" }, { status: 404 });
  }

  const resArchivo = await fetch(origen.urlArchivo);
  if (!resArchivo.ok) {
    return NextResponse.json(
      { error: "No se pudo acceder al archivo original" },
      { status: 500 }
    );
  }
  const buffer = Buffer.from(await resArchivo.arrayBuffer());
  const arrayBuffer = buffer.buffer.slice(
    buffer.byteOffset,
    buffer.byteOffset + buffer.byteLength
  ) as ArrayBuffer;
  const bytes = new Uint8Array(arrayBuffer);

  const baseNombreArchivo = origen.nombreArchivo.replace(/\.[^/.]+$/, "") || "modelo";
  const safeBase = baseNombreArchivo
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "_")
    .replace(/[()[\]{}]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/_+/g, "_")
    .toLowerCase();
  const nombreArchivo = `${safeBase}_copia_${Date.now()}.docx`;

  const urlArchivo = await subirArchivo(
    "modelos-notas",
    nombreArchivo,
    buffer,
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  );

  const tipoNotaId =
    body.tipoNotaId !== undefined
      ? Number.isNaN(Number(body.tipoNotaId))
        ? origen.tipoNotaId
        : Number(body.tipoNotaId)
      : origen.tipoNotaId;

  const include = {
    tipoNota: { select: { id: true, nombre: true, activo: true } },
  } as const;
  const dataBase = {
    nombre,
    tipoNotaId,
    nombreArchivo: origen.nombreArchivo,
    urlArchivo,
    contenido: bytes,
  };
  let nuevo;
  try {
    nuevo = await prisma.modeloNota.create({
      data: { ...dataBase, modeloOrigenId: origen.id, activo: true },
      include,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (
      e instanceof Error &&
      e.name === "PrismaClientValidationError" &&
      (msg.includes("modeloOrigenId") || msg.includes("activo"))
    ) {
      nuevo = await prisma.modeloNota.create({ data: dataBase, include });
    } else {
      throw e;
    }
  }

  const user = session?.user as { id?: string; name?: string; email?: string };
  try {
    await registrarAuditoria({
      userId: user?.id ?? "",
      userNombre: user?.name ?? "",
      userEmail: user?.email ?? "",
      accion: "Duplicó un modelo de nota",
      modulo: "Secretaría",
      ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? undefined,
    });
  } catch {}

  return NextResponse.json(nuevo, { status: 201 });
}

