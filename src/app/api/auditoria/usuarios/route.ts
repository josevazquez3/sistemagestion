import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/** GET - Lista de usuarios distintos que tienen logs (para el filtro, solo Admin) */
export async function GET() {
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

  const logs = await prisma.auditoriaLog.findMany({
    select: { userId: true, userNombre: true, userEmail: true },
    distinct: ["userId"],
    orderBy: { userNombre: "asc" },
  });

  return NextResponse.json({
    data: logs.map((l) => ({ id: l.userId, nombre: l.userNombre, email: l.userEmail })),
  });
}
