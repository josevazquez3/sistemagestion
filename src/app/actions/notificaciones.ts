"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { TipoNotificacion } from "@prisma/client";
import { z } from "zod";

type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string };

export type NotificacionItem = {
  id: number;
  tipo: TipoNotificacion;
  titulo: string;
  mensaje: string;
  leida: boolean;
  solicitudId: number | null;
  createdAt: Date;
};

const notificacionIdSchema = z.number().int().positive();

/**
 * Obtiene las notificaciones del usuario actual.
 */
export async function getNotificaciones(
  limite?: number
): Promise<ActionResult<NotificacionItem[]>> {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false, error: "Debés iniciar sesión." };
    }

    const userId = (session.user as { id?: string }).id;
    if (!userId) {
      return { success: false, error: "Sesión inválida." };
    }

    const take = limite ?? 50;
    const notificaciones = await prisma.notificacion.findMany({
      where: { usuarioId: userId },
      orderBy: { createdAt: "desc" },
      take,
      select: {
        id: true,
        tipo: true,
        titulo: true,
        mensaje: true,
        leida: true,
        solicitudId: true,
        createdAt: true,
      },
    });

    return {
      success: true,
      data: notificaciones.map((n) => ({
        id: n.id,
        tipo: n.tipo,
        titulo: n.titulo,
        mensaje: n.mensaje,
        leida: n.leida,
        solicitudId: n.solicitudId,
        createdAt: n.createdAt,
      })),
    };
  } catch {
    return { success: false, error: "Error al obtener las notificaciones." };
  }
}

/**
 * Obtiene la cantidad de notificaciones no leídas del usuario.
 */
export async function getCantidadNoLeidas(): Promise<ActionResult<number>> {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false, error: "Debés iniciar sesión." };
    }

    const userId = (session.user as { id?: string }).id;
    if (!userId) {
      return { success: false, error: "Sesión inválida." };
    }

    const count = await prisma.notificacion.count({
      where: { usuarioId: userId, leida: false },
    });

    return { success: true, data: count };
  } catch {
    return { success: false, error: "Error al contar notificaciones." };
  }
}

/**
 * Marca una notificación como leída.
 */
export async function marcarNotificacionLeida(
  notificacionId: number
): Promise<ActionResult> {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false, error: "Debés iniciar sesión." };
    }

    const parsed = notificacionIdSchema.safeParse(notificacionId);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message ?? "ID inválido.",
      };
    }

    const userId = (session.user as { id?: string }).id;
    if (!userId) {
      return { success: false, error: "Sesión inválida." };
    }

    const actualizada = await prisma.notificacion.updateMany({
      where: {
        id: parsed.data,
        usuarioId: userId,
      },
      data: { leida: true },
    });

    if (actualizada.count === 0) {
      return { success: false, error: "Notificación no encontrada." };
    }

    return { success: true, data: undefined };
  } catch {
    return { success: false, error: "Error al marcar como leída." };
  }
}

/**
 * Marca todas las notificaciones del usuario como leídas.
 */
export async function marcarTodasLeidas(): Promise<ActionResult> {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false, error: "Debés iniciar sesión." };
    }

    const userId = (session.user as { id?: string }).id;
    if (!userId) {
      return { success: false, error: "Sesión inválida." };
    }

    await prisma.notificacion.updateMany({
      where: { usuarioId: userId, leida: false },
      data: { leida: true },
    });

    return { success: true, data: undefined };
  } catch {
    return { success: false, error: "Error al marcar todas como leídas." };
  }
}
