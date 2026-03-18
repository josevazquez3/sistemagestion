import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { registrarAuditoria } from "@/lib/auditoria";
import type { Prisma } from "@prisma/client";
import { subirArchivo } from "@/lib/blob";
import {
  validarArchivoWordModelo,
  generarNombreAlmacenamientoModeloWord,
  contentTypeWordSubida,
} from "@/lib/legales/modelosOficioArchivo";
import { parsearFechaSegura } from "@/lib/utils/fecha";

const ROLES = ["ADMIN", "SECRETARIA"] as const;
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

function canAccess(roles: string[]) {
  return ROLES.some((r) => roles.includes(r));
}

/** GET - Listar actas con búsqueda, filtro de fechas y paginación */
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

  const where: Prisma.ActaWhereInput = {};

  if (q) {
    where.OR = [
      { titulo: { contains: q, mode: "insensitive" } },
      { nombreArchivo: { contains: q, mode: "insensitive" } },
    ];
  }

  const fechaActaRange: { gte?: Date; lte?: Date } = {};
  if (desde) {
    const d = parsearFechaSegura(desde);
    if (d) fechaActaRange.gte = d;
  }
  if (hasta) {
    const h = parsearFechaSegura(hasta);
    if (h) fechaActaRange.lte = h;
  }
  if (fechaActaRange.gte !== undefined || fechaActaRange.lte !== undefined) {
    where.fechaActa = fechaActaRange;
  }

  const [data, total] = await Promise.all([
    prisma.acta.findMany({
      where,
      orderBy: [{ fechaActa: "desc" }, { id: "desc" }],
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    prisma.acta.count({ where }),
  ]);

  return NextResponse.json({ data, total, page, perPage });
}

/** POST - Crear acta (FormData: titulo, fechaActa, file?) */
export async function POST(req: NextRequest) {
  const session = await auth();
  const roles = (session?.user as { roles?: string[] })?.roles ?? [];
  if (!canAccess(roles)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  try {
    const formData = await req.formData();
    const titulo = (formData.get("titulo") as string)?.trim();
    const fechaActaStr = (formData.get("fechaActa") as string)?.trim();
    const file = formData.get("file") as File | null;

    if (!titulo) {
      return NextResponse.json(
        { error: "El título del acta es obligatorio" },
        { status: 400 }
      );
    }

    const fechaActa = parsearFechaSegura(fechaActaStr ?? "");
    if (!fechaActa) {
      return NextResponse.json(
        { error: "La fecha del acta es obligatoria (formato DD/MM/YYYY)" },
        { status: 400 }
      );
    }

    let nombreArchivo: string | null = null;
    let urlArchivo: string | null = null;

    if (file && file.size > 0) {
      const v = validarArchivoWordModelo(file, MAX_FILE_SIZE);
      if (!v.ok) {
        return NextResponse.json({ error: v.error }, { status: 400 });
      }
      const safeName = generarNombreAlmacenamientoModeloWord(file.name, "acta");
      const mime = contentTypeWordSubida(file.name, file.type);
      urlArchivo = await subirArchivo("actas", safeName, file, mime);
      nombreArchivo = file.name;
    }

    const acta = await prisma.acta.create({
      data: {
        titulo,
        fechaActa,
        nombreArchivo,
        urlArchivo,
      },
    });

    const user = session?.user as { id?: string; name?: string; email?: string };
    await registrarAuditoria({
      userId: user?.id ?? "",
      userNombre: user?.name ?? "",
      userEmail: user?.email ?? "",
      accion: "Creó un acta",
      modulo: "Secretaría",
      ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? undefined,
    });

    return NextResponse.json(acta);
  } catch (e) {
    console.error("Error creando acta:", e);
    return NextResponse.json(
      { error: "Error al crear el acta" },
      { status: 500 }
    );
  }
}

