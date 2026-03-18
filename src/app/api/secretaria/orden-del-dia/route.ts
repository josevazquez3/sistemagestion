import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { registrarAuditoria } from "@/lib/auditoria";
import { subirArchivo } from "@/lib/blob";
import { randomBytes } from "crypto";
import type { Prisma } from "@prisma/client";
import {
  validarArchivoWordModelo,
  contentTypeWordSubida,
  generarNombreAlmacenamientoModeloWord,
  MIME_WORD_DOC,
} from "@/lib/legales/modelosOficioArchivo";
import { parsearFechaSegura } from "@/lib/utils/fecha";

const ROLES_WRITE = ["ADMIN", "SECRETARIA", "SUPER_ADMIN"] as const;
const MAX_FILE_SIZE = 20 * 1024 * 1024;
const PDF_MIME = "application/pdf";
const DOC_MIME = MIME_WORD_DOC;

function normalizeRole(r: unknown): string | null {
  if (typeof r === "string") return r;
  if (r && typeof r === "object" && "nombre" in r && typeof (r as { nombre: unknown }).nombre === "string")
    return (r as { nombre: string }).nombre;
  if (r && typeof r === "object" && "name" in r && typeof (r as { name: unknown }).name === "string")
    return (r as { name: string }).name;
  return null;
}

function canWrite(roles: unknown): boolean {
  const list = Array.isArray(roles) ? roles : [];
  const names = list.map(normalizeRole).filter(Boolean) as string[];
  return ROLES_WRITE.some((r) => names.includes(r));
}

/** GET - Listar documentos */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim() ?? "";
  const categoriaIdParam = searchParams.get("categoriaId")?.trim();
  const tipo = searchParams.get("tipo")?.trim();
  const desde = searchParams.get("desde")?.trim();
  const hasta = searchParams.get("hasta")?.trim();
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const perPage = Math.min(50, Math.max(1, parseInt(searchParams.get("perPage") ?? "20", 10)));

  const where: Prisma.DocumentoOrdenDiaWhereInput = {};

  if (categoriaIdParam && categoriaIdParam !== "todos") {
    const cid = parseInt(categoriaIdParam, 10);
    if (!isNaN(cid)) where.categoriaId = cid;
  }

  if (tipo === "PDF" || tipo === "DOCX" || tipo === "DOC") {
    where.tipoArchivo = tipo;
  }

  const fechaDoc: { gte?: Date; lte?: Date } = {};
  if (desde) {
    const d = parsearFechaSegura(desde);
    if (d) fechaDoc.gte = d;
  }
  if (hasta) {
    const h = parsearFechaSegura(hasta);
    if (h) fechaDoc.lte = h;
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
    prisma.documentoOrdenDia.findMany({
      where,
      orderBy: [{ fechaDocumento: "desc" }, { id: "desc" }],
      skip: (page - 1) * perPage,
      take: perPage,
      include: {
        categoria: { select: { id: true, nombre: true } },
      },
    }),
    prisma.documentoOrdenDia.count({ where }),
  ]);

  return NextResponse.json({ data, total, page, perPage });
}

/** POST - Crear documento */
export async function POST(req: NextRequest) {
  const session = await auth();
  const roles = (session?.user as { roles?: unknown })?.roles ?? [];
  if (!canWrite(roles)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  try {
    const formData = await req.formData();
    const titulo = (formData.get("titulo") as string)?.trim();
    const descripcion = (formData.get("descripcion") as string)?.trim() || null;
    const categoriaIdStr = (formData.get("categoriaId") as string)?.trim();
    const fechaDocumentoStr = (formData.get("fechaDocumento") as string)?.trim();
    const file = formData.get("file") as File | null;

    if (!titulo) {
      return NextResponse.json(
        { error: "El título es obligatorio" },
        { status: 400 }
      );
    }
    if (!file || file.size === 0) {
      return NextResponse.json(
        { error: "Debe seleccionar un archivo PDF, DOC o DOCX" },
        { status: 400 }
      );
    }

    const name = file.name.toLowerCase();
    const isPdf = name.endsWith(".pdf");
    const isDoc = name.endsWith(".doc") && !name.endsWith(".docx");
    const isDocx = name.endsWith(".docx");

    if (!isPdf && !isDoc && !isDocx) {
      return NextResponse.json(
        { error: "Solo se permiten archivos PDF, DOC o DOCX" },
        { status: 400 }
      );
    }

    if (isPdf) {
      const contentType = file.type?.toLowerCase() ?? "";
      const validMime =
        contentType === PDF_MIME ||
        contentType === "application/octet-stream" ||
        contentType === "";
      if (!validMime && file.size > 0) {
        return NextResponse.json(
          { error: "Tipo de archivo no válido. Debe ser PDF" },
          { status: 400 }
        );
      }
    } else {
      const wordVal = validarArchivoWordModelo(file, MAX_FILE_SIZE);
      if (!wordVal.ok) {
        return NextResponse.json({ error: wordVal.error }, { status: 400 });
      }
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

    const fechaDocumento = parsearFechaSegura(fechaDocumentoStr ?? "") ?? null;

    let urlArchivo: string;
    let tipoArchivo: string;
    if (isPdf) {
      const timestamp = Date.now();
      const random = randomBytes(4).toString("hex");
      const safeName = `ordendel_${timestamp}_${random}.pdf`;
      urlArchivo = await subirArchivo("orden-del-dia", safeName, file, PDF_MIME);
      tipoArchivo = "PDF";
    } else {
      const safeName = generarNombreAlmacenamientoModeloWord(file.name, "ordendel");
      const mime = contentTypeWordSubida(file.name, file.type ?? "");
      urlArchivo = await subirArchivo("orden-del-dia", safeName, file, mime);
      tipoArchivo = mime === DOC_MIME || isDoc ? "DOC" : "DOCX";
    }

    const doc = await prisma.documentoOrdenDia.create({
      data: {
        titulo,
        descripcion,
        categoriaId: categoriaId ?? undefined,
        nombreArchivo: file.name,
        urlArchivo,
        tipoArchivo,
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
      accion: "Subió un documento de Orden del día C.S.",
      modulo: "Secretaría",
      ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? undefined,
    });

    return NextResponse.json(doc);
  } catch (e) {
    console.error("Error creando documento orden del día:", e);
    return NextResponse.json(
      { error: "Error al crear el documento" },
      { status: 500 }
    );
  }
}
