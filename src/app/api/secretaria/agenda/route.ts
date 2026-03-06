import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { registrarAuditoria } from "@/lib/auditoria";
import type { Prisma } from "@prisma/client";

const ROLES = ["ADMIN", "SECRETARIA", "SUPER_ADMIN"] as const;

function canAccess(roles: unknown): boolean {
  const list = Array.isArray(roles) ? roles : [];
  const names = list.map((r: unknown) =>
    typeof r === "string" ? r : (r as { nombre?: string })?.nombre ?? (r as { name?: string })?.name
  ).filter(Boolean) as string[];
  return ROLES.some((r) => names.includes(r));
}

function parseFechaArgentina(str: string): Date | null {
  if (!str?.trim()) return null;
  const parts = str.trim().split("/").map((x) => parseInt(x, 10));
  if (parts.length !== 3) return null;
  const [d, m, y] = parts;
  if (!d || !m || !y) return null;
  const date = new Date(y, m - 1, d);
  return isNaN(date.getTime()) ? null : date;
}

/** GET - Listar reuniones */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (!canAccess((session?.user as { roles?: unknown })?.roles ?? [])) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim() ?? "";
  const desde = searchParams.get("desde")?.trim();
  const hasta = searchParams.get("hasta")?.trim();
  const estado = searchParams.get("estado")?.trim();
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const perPage = Math.min(50, Math.max(1, parseInt(searchParams.get("perPage") ?? "20", 10)));

  const where: Prisma.ReunionWhereInput = {};

  if (estado === "PENDIENTE" || estado === "FINALIZADA") {
    where.estado = estado;
  }

  const fechaRange: { gte?: Date; lte?: Date } = {};
  if (desde) {
    const d = parseFechaArgentina(desde);
    if (d) fechaRange.gte = d;
  }
  if (hasta) {
    const h = parseFechaArgentina(hasta);
    if (h) {
      const end = new Date(h);
      end.setHours(23, 59, 59, 999);
      fechaRange.lte = end;
    }
  }
  if (fechaRange.gte !== undefined || fechaRange.lte !== undefined) {
    where.fechaReunion = fechaRange;
  }

  if (q) {
    where.OR = [
      { organismo: { contains: q, mode: "insensitive" } },
      { observacion: { contains: q, mode: "insensitive" } },
      { contactoNombre: { contains: q, mode: "insensitive" } },
      { contactoApellido: { contains: q, mode: "insensitive" } },
    ];
  }

  const [data, total] = await Promise.all([
    prisma.reunion.findMany({
      where,
      orderBy: { fechaReunion: "desc" },
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    prisma.reunion.count({ where }),
  ]);

  return NextResponse.json({ data, total, page, perPage });
}

/** POST - Crear reunión */
export async function POST(req: NextRequest) {
  const session = await auth();
  const roles = (session?.user as { roles?: unknown })?.roles ?? [];
  if (!canAccess(roles)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const organismo = body.organismo?.trim();
    const fechaReunionStr = body.fechaReunion?.trim();
    const fechaReunion = parseFechaArgentina(fechaReunionStr ?? "");
    if (!organismo) {
      return NextResponse.json({ error: "Organismo / Institución es obligatorio" }, { status: 400 });
    }
    if (!fechaReunion) {
      return NextResponse.json({ error: "Fecha de la reunión es obligatoria (DD/MM/YYYY)" }, { status: 400 });
    }

    const reunion = await prisma.reunion.create({
      data: {
        organismo,
        fechaReunion,
        hora: body.hora?.trim() || null,
        observacion: body.observacion?.trim() || null,
        contactoNombre: body.contactoNombre?.trim() || null,
        contactoApellido: body.contactoApellido?.trim() || null,
        contactoCargo: body.contactoCargo?.trim() || null,
        contactoTelefono: body.contactoTelefono?.trim() || null,
        contactoMail: body.contactoMail?.trim() || null,
      },
    });

    const user = session?.user as { id?: string; name?: string; email?: string };
    await registrarAuditoria({
      userId: user?.id ?? "",
      userNombre: user?.name ?? "",
      userEmail: user?.email ?? "",
      accion: "Creó una reunión en la agenda",
      modulo: "Secretaría",
      ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? undefined,
    });

    return NextResponse.json(reunion);
  } catch (e) {
    console.error("Error creando reunión:", e);
    return NextResponse.json({ error: "Error al crear la reunión" }, { status: 500 });
  }
}
