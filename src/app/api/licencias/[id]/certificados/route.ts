import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { registrarAuditoria } from "@/lib/auditoria";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { EtapaCertificado, TipoArchivo } from "@prisma/client";

const ROLES_LICENCIAS = ["ADMIN", "RRHH"] as const;
const ALLOWED_TYPES = ["application/pdf", "image/jpeg", "image/jpg"];
const MAX_SIZE = 10 * 1024 * 1024; // 10 MB

function canManageLicencias(roles: string[]) {
  return ROLES_LICENCIAS.some((r) => roles.includes(r));
}

function getTipoArchivo(mime: string): TipoArchivo {
  if (mime === "application/pdf") return TipoArchivo.PDF;
  return TipoArchivo.JPG;
}

/** GET - Listar certificados de una licencia */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const roles = (session?.user as { roles?: string[] })?.roles ?? [];
  if (!canManageLicencias(roles)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const id = parseInt((await params).id, 10);
  if (isNaN(id)) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

  const licencia = await prisma.licencia.findUnique({
    where: { id },
    include: { certificados: true, legajo: true },
  });
  if (!licencia) return NextResponse.json({ error: "Licencia no encontrada" }, { status: 404 });

  return NextResponse.json({ data: licencia.certificados });
}

/** POST - Subir certificados a una licencia (FormData: files[], etapa) */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const roles = (session?.user as { roles?: string[] })?.roles ?? [];
  if (!canManageLicencias(roles)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const id = parseInt((await params).id, 10);
  if (isNaN(id)) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

  const licencia = await prisma.licencia.findUnique({
    where: { id },
    include: { legajo: true },
  });
  if (!licencia) return NextResponse.json({ error: "Licencia no encontrada" }, { status: 404 });

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "FormData inválido" }, { status: 400 });
  }

  const etapa = formData.get("etapa") as string;
  if (!etapa || (etapa !== EtapaCertificado.INICIO && etapa !== EtapaCertificado.CIERRE)) {
    return NextResponse.json({ error: "etapa debe ser INICIO o CIERRE" }, { status: 400 });
  }

  const files = formData.getAll("files") as File[];
  if (!files.length) {
    return NextResponse.json({ error: "No se enviaron archivos" }, { status: 400 });
  }

  const uploadDir = path.join(process.cwd(), "public", "uploads", "certificados");
  try {
    await mkdir(uploadDir, { recursive: true });
  } catch (e) {
    console.error("Error creando directorio uploads:", e);
    return NextResponse.json({ error: "Error al crear directorio de subida" }, { status: 500 });
  }

  const creados: { id: number; nombreArchivo: string; urlArchivo: string }[] = [];

  for (const file of files) {
    if (!(file instanceof File) || !file.size) continue;

    const mime = file.type?.toLowerCase();
    if (!ALLOWED_TYPES.includes(mime)) {
      return NextResponse.json(
        { error: "Solo se permiten archivos PDF y JPG" },
        { status: 400 }
      );
    }
    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: "El archivo supera el tamaño máximo (10 MB)" },
        { status: 400 }
      );
    }

    const ext = mime === "application/pdf" ? "pdf" : "jpg";
    const safeName = `${id}-${etapa}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const filePath = path.join(uploadDir, safeName);
    const urlArchivo = `/uploads/certificados/${safeName}`;

    try {
      const buffer = Buffer.from(await file.arrayBuffer());
      await writeFile(filePath, buffer);
    } catch (e) {
      console.error("Error escribiendo archivo:", e);
      return NextResponse.json({ error: "Error al guardar el archivo" }, { status: 500 });
    }

    const cert = await prisma.certificado.create({
      data: {
        licenciaId: id,
        legajoId: licencia.legajoId,
        nombreArchivo: file.name || safeName,
        tipoArchivo: getTipoArchivo(mime),
        urlArchivo,
        etapa: etapa as EtapaCertificado,
      },
    });
    creados.push({ id: cert.id, nombreArchivo: cert.nombreArchivo, urlArchivo: cert.urlArchivo });
  }

  const user = session?.user as { id?: string; name?: string; email?: string };
  try {
    await registrarAuditoria({
      userId: user?.id ?? "",
      userNombre: user?.name ?? "",
      userEmail: user?.email ?? "",
      accion: "Subió certificado(s)",
      modulo: "Licencias",
      detalle: `Licencia ID ${id} - ${creados.length} archivo(s)`,
      ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? undefined,
    });
  } catch {}

  return NextResponse.json({ data: creados });
}
