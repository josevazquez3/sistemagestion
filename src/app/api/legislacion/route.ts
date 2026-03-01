import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { registrarAuditoria } from "@/lib/auditoria";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { randomBytes } from "crypto";
import { SeccionLegislacion } from "@prisma/client";
import type { Prisma } from "@prisma/client";

const ROLES_WRITE = ["ADMIN", "SECRETARIA"] as const;
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB
const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const PDF_MIME = "application/pdf";

function canWrite(roles: string[]) {
  return ROLES_WRITE.some((r) => roles.includes(r));
}

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "legislacion");

function parseFechaArgentina(str: string): Date | null {
  if (!str) return null;
  const [d, m, y] = str.split("/").map((x) => parseInt(x, 10));
  if (!d || !m || !y) return null;
  const date = new Date(y, m - 1, d);
  if (isNaN(date.getTime())) return null;
  return date;
}

function validarSeccion(s: string): s is SeccionLegislacion {
  return s === "LEGISLACION" || s === "RESOLUCIONES_CS";
}

/** GET - Listar documentos (cualquier usuario autenticado) */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const seccionParam = searchParams.get("seccion")?.trim();
  const q = searchParams.get("q")?.trim() ?? "";
  const categoriaIdParam = searchParams.get("categoriaId")?.trim();
  const tipo = searchParams.get("tipo")?.trim(); // "" | "PDF" | "DOCX"
  const desde = searchParams.get("desde")?.trim();
  const hasta = searchParams.get("hasta")?.trim();
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const perPage = Math.min(50, Math.max(1, parseInt(searchParams.get("perPage") ?? "20", 10)));

  const where: Prisma.DocumentoLegislacionWhereInput = {};

  if (seccionParam && validarSeccion(seccionParam)) {
    where.seccion = seccionParam;
  }

  if (categoriaIdParam && categoriaIdParam !== "todos") {
    const cid = parseInt(categoriaIdParam, 10);
    if (!isNaN(cid)) where.categoriaId = cid;
  }

  if (tipo === "PDF" || tipo === "DOCX") {
    where.tipoArchivo = tipo;
  }

  const fechaDoc: { gte?: Date; lte?: Date } = {};
  if (desde) {
    const d = parseFechaArgentina(desde);
    if (d) fechaDoc.gte = d;
  }
  if (hasta) {
    const h = parseFechaArgentina(hasta);
    if (h) {
      const endOfDay = new Date(h);
      endOfDay.setHours(23, 59, 59, 999);
      fechaDoc.lte = endOfDay;
    }
  }
  if (fechaDoc.gte !== undefined || fechaDoc.lte !== undefined) {
    where.fechaDocumento = fechaDoc;
  }

  if (q) {
    where.OR = [
      { titulo: { contains: q, mode: "insensitive" } },
      { descripcion: { contains: q, mode: "insensitive" } },
      { nombreArchivo: { contains: q, mode: "insensitive" } },
      { categoria: { nombre: { contains: q, mode: "insensitive" } } },
    ];
  }

  const [data, total] = await Promise.all([
    prisma.documentoLegislacion.findMany({
      where,
      orderBy: [{ fechaDocumento: "desc" }, { id: "desc" }],
      skip: (page - 1) * perPage,
      take: perPage,
      include: {
        categoria: { select: { id: true, nombre: true } },
      },
    }),
    prisma.documentoLegislacion.count({ where }),
  ]);

  return NextResponse.json({ data, total, page, perPage });
}

/** POST - Crear documento (solo Admin y Secretaria) */
export async function POST(req: NextRequest) {
  const session = await auth();
  const roles = (session?.user as { roles?: string[] })?.roles ?? [];
  if (!canWrite(roles)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  try {
    const formData = await req.formData();
    const titulo = (formData.get("titulo") as string)?.trim();
    const descripcion = (formData.get("descripcion") as string)?.trim() || null;
    const categoriaIdStr = (formData.get("categoriaId") as string)?.trim();
    const fechaDocumentoStr = (formData.get("fechaDocumento") as string)?.trim();
    const seccionParam = (formData.get("seccion") as string)?.trim();
    const file = formData.get("file") as File | null;

    if (!titulo) {
      return NextResponse.json(
        { error: "El título es obligatorio" },
        { status: 400 }
      );
    }
    if (!seccionParam || !validarSeccion(seccionParam)) {
      return NextResponse.json(
        { error: "La sección es obligatoria (LEGISLACION o RESOLUCIONES_CS)" },
        { status: 400 }
      );
    }
    if (!file || file.size === 0) {
      return NextResponse.json(
        { error: "Debe seleccionar un archivo PDF o DOCX" },
        { status: 400 }
      );
    }

    const name = file.name.toLowerCase();
    const isPdf = name.endsWith(".pdf");
    const isDocx = name.endsWith(".docx");
    if (!isPdf && !isDocx) {
      return NextResponse.json(
        { error: "Solo se permiten archivos PDF o DOCX" },
        { status: 400 }
      );
    }

    const contentType = file.type?.toLowerCase() ?? "";
    const validMime =
      contentType === PDF_MIME ||
      contentType === DOCX_MIME ||
      contentType === "application/octet-stream" ||
      contentType === "";
    if (!validMime && file.size > 0) {
      return NextResponse.json(
        { error: "Tipo de archivo no válido. Debe ser PDF o DOCX" },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "El archivo no puede superar 20 MB" },
        { status: 400 }
      );
    }

    const categoriaId =
      categoriaIdStr && categoriaIdStr !== "todos"
        ? parseInt(categoriaIdStr, 10)
        : null;
    if (categoriaIdStr && categoriaIdStr !== "todos" && (isNaN(categoriaId ?? NaN))) {
      return NextResponse.json({ error: "Categoría inválida" }, { status: 400 });
    }

    const fechaDocumento = parseFechaArgentina(fechaDocumentoStr ?? "") ?? null;

    await mkdir(UPLOAD_DIR, { recursive: true });
    const ext = isPdf ? "pdf" : "docx";
    const timestamp = Date.now();
    const random = randomBytes(4).toString("hex");
    const safeName = `leg_${timestamp}_${random}.${ext}`;
    const filePath = path.join(UPLOAD_DIR, safeName);
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(filePath, buffer);

    const urlArchivo = `/uploads/legislacion/${safeName}`;
    const tipoArchivo = isPdf ? "PDF" : "DOCX";

    const doc = await prisma.documentoLegislacion.create({
      data: {
        titulo,
        descripcion,
        categoriaId: categoriaId ?? undefined,
        nombreArchivo: file.name,
        urlArchivo,
        tipoArchivo,
        seccion: seccionParam as SeccionLegislacion,
        fechaDocumento,
      },
      include: {
        categoria: { select: { id: true, nombre: true } },
      },
    });

    const user = session?.user as { id?: string; name?: string; email?: string };
    await registrarAuditoria({
      userId: user?.id ?? "",
      userNombre: user?.name ?? "",
      userEmail: user?.email ?? "",
      accion: "Subió un documento de legislación",
      modulo: "Legislación",
      ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? undefined,
    });

    return NextResponse.json(doc);
  } catch (e) {
    console.error("Error creando documento legislación:", e);
    return NextResponse.json(
      { error: "Error al crear el documento" },
      { status: 500 }
    );
  }
}
