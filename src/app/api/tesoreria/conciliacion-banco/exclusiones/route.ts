import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const ROLES = ["ADMIN", "TESORERO", "SUPER_ADMIN"] as const;

function canAccess(roles: string[]) {
  return ROLES.some((r) => roles.includes(r));
}

export async function POST(req: NextRequest) {
  const session = await auth();
  const roles = (session?.user as { roles?: string[] })?.roles ?? [];
  if (!canAccess(roles)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  let body: { mes: number; anio: number; movimientoIds: number[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
  }

  const { mes, anio, movimientoIds } = body;
  if (!Array.isArray(movimientoIds) || movimientoIds.length === 0) {
    return NextResponse.json({ error: "No se indicaron movimientos" }, { status: 400 });
  }

  const conciliacion = await prisma.conciliacionBanco.findUnique({
    where: { mes_anio: { mes, anio } },
  });
  if (!conciliacion) {
    return NextResponse.json({ error: "Conciliación no encontrada" }, { status: 404 });
  }

  if (conciliacion.cerrado) {
    return NextResponse.json({ error: "El período está cerrado" }, { status: 403 });
  }

  const ids = movimientoIds.map((id) => Number(id)).filter((id) => !isNaN(id) && id > 0);
  if (ids.length === 0) {
    return NextResponse.json({ error: "IDs inválidos" }, { status: 400 });
  }

  const ex = (
    prisma as unknown as {
      conciliacionExclusion?: {
        createMany: (args: {
          data: { conciliacionId: number; movimientoId: number }[];
          skipDuplicates?: boolean;
        }) => Promise<unknown>;
      };
    }
  ).conciliacionExclusion;
  if (!ex?.createMany) {
    return NextResponse.json(
      {
        error:
          "El servidor no tiene el modelo de exclusiones. Ejecutá: npx prisma migrate deploy && npx prisma generate",
      },
      { status: 503 }
    );
  }
  await ex.createMany({
    data: ids.map((movimientoId) => ({
      conciliacionId: conciliacion.id,
      movimientoId,
    })),
    skipDuplicates: true,
  });

  return NextResponse.json({ ok: true, excluidos: ids.length });
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  const roles = (session?.user as { roles?: string[] })?.roles ?? [];
  if (!canAccess(roles)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  let body: { mes: number; anio: number; movimientoIds: number[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
  }

  const { mes, anio, movimientoIds } = body;
  if (!Array.isArray(movimientoIds) || movimientoIds.length === 0) {
    return NextResponse.json({ error: "No se indicaron movimientos" }, { status: 400 });
  }

  const conciliacion = await prisma.conciliacionBanco.findUnique({
    where: { mes_anio: { mes, anio } },
  });
  if (!conciliacion) {
    return NextResponse.json({ error: "Conciliación no encontrada" }, { status: 404 });
  }

  const ids = movimientoIds.map((id) => Number(id)).filter((id) => !isNaN(id) && id > 0);

  const exDel = (
    prisma as unknown as {
      conciliacionExclusion?: {
        deleteMany: (args: {
          where: { conciliacionId: number; movimientoId: { in: number[] } };
        }) => Promise<unknown>;
      };
    }
  ).conciliacionExclusion;
  if (exDel?.deleteMany) {
    await exDel.deleteMany({
      where: {
        conciliacionId: conciliacion.id,
        movimientoId: { in: ids },
      },
    });
  }

  return NextResponse.json({ ok: true });
}
