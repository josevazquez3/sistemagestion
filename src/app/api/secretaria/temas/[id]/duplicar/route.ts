import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { canAccess, ensureTemasTables, getSessionUser, parseId } from "../../_shared";

const includeTemaRespuesta = {
  usuario: { select: { id: true, nombre: true, apellido: true, email: true } },
  asignaciones: true,
  usos: true,
} satisfies Prisma.TemaInclude;

type TemaDuplicado = Prisma.TemaGetPayload<{ include: typeof includeTemaRespuesta }>;

/** Evita colisión de `numero` (UNIQUE) si varios POST /duplicar corren en paralelo. */
const ADVISORY_LOCK_TEMA_NUMERO = 982_451_001;

const TZ_AR = "America/Argentina/Buenos_Aires";

/** “Hoy” calendario en Argentina → mediodía UTC de ese día (coherente con el resto del módulo). */
function mediodiaUTCHoyArgentina(): Date {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ_AR,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const y = parseInt(parts.find((p) => p.type === "year")?.value ?? "0", 10);
  const mo = parseInt(parts.find((p) => p.type === "month")?.value ?? "0", 10);
  const d = parseInt(parts.find((p) => p.type === "day")?.value ?? "0", 10);
  return new Date(Date.UTC(y, mo - 1, d, 12, 0, 0, 0));
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  const usuarioId = user?.id;
  if (!user || !canAccess(user.roles ?? [])) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }
  if (!usuarioId) {
    return NextResponse.json({ error: "Sesión inválida" }, { status: 401 });
  }

  await ensureTemasTables();

  const id = parseId((await params).id);
  if (id == null) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

  const original = await prisma.tema.findUnique({
    where: { id },
    include: { asignaciones: true },
  });

  if (!original) {
    return NextResponse.json({ error: "Tema no encontrado" }, { status: 404 });
  }

  const hoy = mediodiaUTCHoyArgentina();
  const tieneOD = original.asignaciones.some((a) => a.tipo === "AL_ORDEN_DEL_DIA");
  const tieneGuia = original.asignaciones.some((a) => a.tipo === "AL_INFORME_GUIA");

  try {
    const nuevo = await prisma.$transaction(async (tx): Promise<TemaDuplicado> => {
      await tx.$executeRawUnsafe(
        `SELECT pg_advisory_xact_lock(${ADVISORY_LOCK_TEMA_NUMERO})`
      );
      const maxNumero = await tx.tema.aggregate({ _max: { numero: true } });
      const nuevoNumero = (maxNumero._max.numero ?? 0) + 1;

      return tx.tema.create({
        data: {
          numero: nuevoNumero,
          fecha: hoy,
          tema: original.tema,
          observacion: original.observacion,
          usuarioId,
          estado: "PENDIENTE",
          asignaciones: {
            create: original.asignaciones.map((a) => ({
              tipo: a.tipo,
              otroTexto: a.otroTexto ?? null,
            })),
          },
          usos: {
            create: {
              fechaOD: tieneOD ? hoy : null,
              guiaMesa: tieneGuia ? hoy : null,
            },
          },
        },
        include: includeTemaRespuesta,
      });
    });

    return NextResponse.json(
      {
        ...nuevo,
        fecha: nuevo.fecha.toISOString(),
        createdAt: nuevo.createdAt.toISOString(),
        updatedAt: nuevo.updatedAt.toISOString(),
        usos: nuevo.usos.map((u) => ({
          ...u,
          fechaOD: u.fechaOD ? u.fechaOD.toISOString() : null,
          guiaMesa: u.guiaMesa ? u.guiaMesa.toISOString() : null,
          createdAt: u.createdAt.toISOString(),
        })),
        usuario: {
          ...nuevo.usuario,
          nombreCompleto: `${nuevo.usuario.nombre} ${nuevo.usuario.apellido}`.trim(),
        },
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("temas duplicar POST:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error al duplicar tema" },
      { status: 500 }
    );
  }
}
