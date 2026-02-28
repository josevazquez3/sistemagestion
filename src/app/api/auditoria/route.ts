import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/** GET - Lista logs con filtros y paginación (solo Admin) */
export async function GET(req: NextRequest) {
  const session = await auth();
  const roles = (session?.user as { roles?: string[] })?.roles ?? [];
  if (!roles.includes("ADMIN")) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  if (typeof prisma.auditoriaLog?.findMany !== "function") {
    return NextResponse.json(
      {
        error:
          "El cliente Prisma no tiene el modelo AuditoriaLog. Cerrando el servidor, ejecutá: npx prisma generate && npx prisma db push. Luego reiniciá con npm run dev.",
      },
      { status: 503 }
    );
  }

  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId") ?? undefined;
  const modulo = searchParams.get("modulo") ?? undefined;
  const desde = searchParams.get("desde") ?? undefined;
  const hasta = searchParams.get("hasta") ?? undefined;
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
  const perPage = Math.min(100, Math.max(1, parseInt(searchParams.get("perPage") ?? "20")));

  const where: { userId?: string; modulo?: string; creadoEn?: { gte?: Date; lte?: Date } } = {};
  if (userId) where.userId = userId;
  if (modulo) where.modulo = modulo;
  if (desde) where.creadoEn = { ...where.creadoEn, gte: new Date(desde) };
  if (hasta) {
    const h = new Date(hasta);
    h.setHours(23, 59, 59, 999);
    where.creadoEn = { ...where.creadoEn, lte: h };
  }

  const [logs, total] = await Promise.all([
    prisma.auditoriaLog.findMany({
      where,
      orderBy: { creadoEn: "desc" },
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    prisma.auditoriaLog.count({ where }),
  ]);

  return NextResponse.json({
    data: logs,
    pagination: { page, perPage, total, totalPages: Math.ceil(total / perPage) },
  });
}
