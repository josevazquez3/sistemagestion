"use server";

import { revalidatePath } from "next/cache";
import type { TsdEstado, TsdMovimiento, TsdExpediente } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { fechaSeguraParaPrisma } from "@/lib/utils/fecha";
import { ensureTsdTables } from "@/lib/legales/ensureTsdTables";

export type TsdExpedienteConMovimientos = TsdExpediente & {
  movimientos: TsdMovimiento[];
};

export type TsdMovimientoConExpediente = TsdMovimiento & {
  expediente: TsdExpediente;
};

const TSD_ROLES = new Set(["SUPER_ADMIN", "ADMIN", "LEGALES", "SECRETARIA"]);

function revalidateTsdViews() {
  revalidatePath("/legales/tsd");
  revalidatePath("/dashboard");
}

async function assertTsdAccess() {
  const session = await auth();
  const roles = (session?.user as { roles?: string[] })?.roles ?? [];
  if (!roles.some((r) => TSD_ROLES.has(r))) {
    throw new Error("No autorizado");
  }
}

function normalizeFechaInput(fecha: Date | string): Date {
  return fechaSeguraParaPrisma(typeof fecha === "string" ? new Date(fecha) : fecha);
}

export async function getExpedientes(search?: string): Promise<TsdExpedienteConMovimientos[]> {
  await assertTsdAccess();
  await ensureTsdTables();
  const q = (search ?? "").trim();
  return prisma.tsdExpediente.findMany({
    where: q
      ? {
          nroExpte: { contains: q, mode: "insensitive" },
        }
      : undefined,
    include: {
      movimientos: { orderBy: { fecha: "asc" } },
    },
    orderBy: { nroExpte: "asc" },
  });
}

export async function createExpediente(data: {
  fecha: Date | string;
  nroExpte: string;
  caratula: string;
  distrito: string;
  estado: TsdEstado;
  observacion?: string | null;
}): Promise<void> {
  await assertTsdAccess();
  await ensureTsdTables();
  const nro = data.nroExpte.trim();
  if (!nro) throw new Error("Nº de expediente obligatorio");

  const fecha = normalizeFechaInput(data.fecha);

  await prisma.tsdExpediente.upsert({
    where: { nroExpte: nro },
    create: {
      nroExpte: nro,
      caratula: data.caratula.trim(),
      distrito: data.distrito.trim(),
      movimientos: {
        create: {
          fecha,
          estado: data.estado,
          observacion: data.observacion?.trim() || null,
        },
      },
    },
    update: {
      caratula: data.caratula.trim(),
      distrito: data.distrito.trim(),
      movimientos: {
        create: {
          fecha,
          estado: data.estado,
          observacion: data.observacion?.trim() || null,
        },
      },
    },
  });

  revalidateTsdViews();
}

export async function addMovimiento(data: {
  expedienteId: number;
  fecha: Date | string;
  estado: TsdEstado;
  observacion?: string | null;
}): Promise<void> {
  await assertTsdAccess();
  await ensureTsdTables();
  await prisma.tsdMovimiento.create({
    data: {
      expedienteId: data.expedienteId,
      fecha: normalizeFechaInput(data.fecha),
      estado: data.estado,
      observacion: data.observacion?.trim() || null,
    },
  });
  revalidateTsdViews();
}

export async function updateMovimiento(
  id: number,
  data: {
    fecha: Date | string;
    estado: TsdEstado;
    observacion?: string | null;
  }
): Promise<void> {
  await assertTsdAccess();
  await ensureTsdTables();
  await prisma.tsdMovimiento.update({
    where: { id },
    data: {
      fecha: normalizeFechaInput(data.fecha),
      estado: data.estado,
      observacion: data.observacion?.trim() || null,
    },
  });
  revalidateTsdViews();
}

export async function deleteMovimiento(id: number): Promise<void> {
  await assertTsdAccess();
  await ensureTsdTables();
  const mov = await prisma.tsdMovimiento.findUnique({
    where: { id },
    select: { expedienteId: true },
  });
  if (!mov) return;

  await prisma.tsdMovimiento.delete({ where: { id } });

  const remaining = await prisma.tsdMovimiento.count({
    where: { expedienteId: mov.expedienteId },
  });
  if (remaining === 0) {
    await prisma.tsdExpediente.delete({ where: { id: mov.expedienteId } });
  }

  revalidateTsdViews();
}

export async function getMovimientosByNroExpte(
  nroExpte: string
): Promise<TsdMovimientoConExpediente[]> {
  await assertTsdAccess();
  await ensureTsdTables();
  const n = nroExpte.trim();
  if (!n) return [];

  const expte = await prisma.tsdExpediente.findFirst({
    where: { nroExpte: { equals: n, mode: "insensitive" } },
    include: {
      movimientos: { orderBy: { fecha: "asc" } },
    },
  });
  if (!expte) return [];

  return expte.movimientos.map((m) => ({
    ...m,
    expediente: {
      id: expte.id,
      nroExpte: expte.nroExpte,
      caratula: expte.caratula,
      distrito: expte.distrito,
      finalizado: expte.finalizado,
      creadoEn: expte.creadoEn,
      actualizadoEn: expte.actualizadoEn,
    },
  }));
}

export async function setExpedienteFinalizado(expedienteId: number, finalizado: boolean): Promise<void> {
  await assertTsdAccess();
  await ensureTsdTables();
  await prisma.tsdExpediente.update({
    where: { id: expedienteId },
    data: { finalizado },
  });
  revalidateTsdViews();
}
