import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { registrarAuditoria } from "@/lib/auditoria";
import type { Prisma } from "@prisma/client";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { randomBytes } from "crypto";

const ROLES = ["ADMIN", "LEGALES"] as const;
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const PDF_MIME = "application/pdf";

function canAccess(roles: string[]) {
  return ROLES.some((r) => roles.includes(r));
}

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "historial-oficios");

function parseFechaArgentina(str: string): Date | null {
  if (!str) return null;
  const [d, m, y] = str.split("/").map((x) => parseInt(x, 10));
  if (!d || !m || !y) return null;
  const date = new Date(y, m - 1, d);
  if (isNaN(date.getTime())) return null;
  return date;
}

/** GET - Listar oficios con búsqueda, filtro de fechas y paginación */
export async function GET(req: NextRequest) {
  const session = await auth();
  const roles = (session?.user as { roles?: string[] })?.roles ?? [];
  if (!canAccess(roles)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim() ?? "";
  const desde = searchParams.get("desde")?.trim();
  const hasta = searchParams.get("hasta")?.trim();
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const perPage = Math.min(50, Math.max(1, parseInt(searchParams.get("perPage") ?? "20", 10)));

  const where: Prisma.OficioRespondidoWhereInput = {};

  if (q) {
    where.OR = [
      { titulo: { contains: q, mode: "insensitive" } },
      { nombreArchivo: { contains: q, mode: "insensitive" } },
    ];
  }

  const fechaOficioRange: { gte?: Date; lte?: Date } = {};
  if (desde) {
    const d = parseFechaArgentina(desde);
    if (d) fechaOficioRange.gte = d;
  }
  if (hasta) {
    const h = parseFechaArgentina(hasta);
    if (h) {
      const endOfDay = new Date(h);
      endOfDay.setHours(23, 59, 59, 999);
      fechaOficioRange.lte = endOfDay;
    }
  }
  if (fechaOficioRange.gte !== undefined || fechaOficioRange.lte !== undefined) {
    where.fechaOficio = fechaOficioRange;
  }

  const [data, total] = await Promise.all([
    prisma.oficioRespondido.findMany({
      where,
      orderBy: [{ fechaOficio: "desc" }, { id: "desc" }],
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    prisma.oficioRespondido.count({ where }),
  ]);

  return NextResponse.json({ data, total, page, perPage });
}

/** POST - Crear oficio respondido (FormData: titulo, fechaOficio, file?) */
export async function POST(req: NextRequest) {
  const session = await auth();
  const roles = (session?.user as { roles?: string[] })?.roles ?? [];
  if (!canAccess(roles)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  try {
    const formData = await req.formData();
    const titulo = (formData.get("titulo") as string)?.trim();
    const fechaOficioStr = (formData.get("fechaOficio") as string)?.trim();
    const file = formData.get("file") as File | null;

    if (!titulo) {
      return NextResponse.json(
        { error: "El título del oficio es obligatorio" },
        { status: 400 }
      );
    }

    const fechaOficio = parseFechaArgentina(fechaOficioStr ?? "");
    if (!fechaOficio) {
      return NextResponse.json(
        { error: "La fecha del oficio es obligatoria (formato DD/MM/YYYY)" },
        { status: 400 }
      );
    }

    let nombreArchivo: string | null = null;
    let urlArchivo: string | null = null;

    if (file && file.size > 0) {
      const name = file.name.toLowerCase();
      if (!name.endsWith(".pdf")) {
        return NextResponse.json(
          { error: "Solo se permiten archivos PDF" },
          { status: 400 }
        );
      }
      const contentType = file.type?.toLowerCase() ?? "";
      const validMime =
        contentType === PDF_MIME ||
        contentType === "application/octet-stream" ||
        contentType === "";
      if (!validMime) {
        return NextResponse.json(
          { error: "Tipo de archivo no válido. Debe ser PDF" },
          { status: 400 }
        );
      }
      if (file.size > MAX_FILE_SIZE) {
        return NextResponse.json(
          { error: "El archivo no puede superar 10 MB" },
          { status: 400 }
        );
      }

      await mkdir(UPLOAD_DIR, { recursive: true });
      const timestamp = Date.now();
      const random = randomBytes(4).toString("hex");
      const safeName = `oficio_${timestamp}_${random}.pdf`;
      const filePath = path.join(UPLOAD_DIR, safeName);
      const buffer = Buffer.from(await file.arrayBuffer());
      await writeFile(filePath, buffer);
      nombreArchivo = file.name;
      urlArchivo = `/uploads/historial-oficios/${safeName}`;
    }

    const oficio = await prisma.oficioRespondido.create({
      data: {
        titulo,
        fechaOficio,
        nombreArchivo,
        urlArchivo,
      },
    });

    const user = session?.user as { id?: string; name?: string; email?: string };
    await registrarAuditoria({
      userId: user?.id ?? "",
      userNombre: user?.name ?? "",
      userEmail: user?.email ?? "",
      accion: "Creó un oficio respondido",
      modulo: "Legales",
      ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? undefined,
    });

    return NextResponse.json(oficio);
  } catch (e) {
    console.error("Error creando oficio respondido:", e);
    return NextResponse.json(
      { error: "Error al crear el oficio" },
      { status: 500 }
    );
  }
}
