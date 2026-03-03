"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { calcularDiasVacaciones } from "@/lib/vacaciones.utils";
import { z } from "zod";
import { EstadoVacaciones, TipoNotificacion } from "@prisma/client";
import { formatearFecha } from "@/lib/vacaciones.utils";

type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string };

const ROLES_ADMIN = ["ADMIN", "RRHH"] as const;

function esAdmin(roles: string[]): boolean {
  return ROLES_ADMIN.some((r) => roles.includes(r));
}

const legajoIdSchema = z.string().min(1, "Legajo es requerido");
const fechaSchema = z.coerce.date();
const diasSchema = z.number().int().min(1).max(365);
const secretarioSchema = z.string().min(1, "Nombre del secretario es requerido");
const solicitudIdSchema = z.coerce.number().int().positive();

const setConfigSchema = z.object({
  legajoId: legajoIdSchema,
  diasDisponibles: diasSchema,
  secretarioGeneral: secretarioSchema,
});

const crearSolicitudSchema = z.object({
  legajoId: legajoIdSchema,
  fechaDesde: fechaSchema,
  fechaHasta: fechaSchema,
});

const editarSolicitudSchema = z.object({
  solicitudId: solicitudIdSchema,
  fechaDesde: fechaSchema,
  fechaHasta: fechaSchema,
});

const vincularSchema = z.object({
  userId: z.string().min(1),
  legajoId: z.string().min(1),
});

/**
 * Obtiene la configuración de vacaciones de un empleado.
 * Solo ADMIN y RRHH pueden ejecutar esta acción.
 */
export async function getConfiguracionVacaciones(
  legajoId: string
): Promise<ActionResult<{ diasDisponibles: number; secretarioGeneral: string } | null>> {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false, error: "Debés iniciar sesión." };
    }

    const roles = (session.user as { roles?: string[] }).roles ?? [];
    if (!esAdmin(roles)) {
      return { success: false, error: "No tenés permisos para realizar esta acción." };
    }

    const parsed = legajoIdSchema.safeParse(legajoId);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
    }

    const config = await prisma.configuracionVacaciones.findUnique({
      where: { legajoId: parsed.data },
    });

    if (!config) {
      return { success: true, data: null };
    }

    return {
      success: true,
      data: {
        diasDisponibles: config.diasDisponibles,
        secretarioGeneral: config.secretarioGeneral,
      },
    };
  } catch {
    return { success: false, error: "Error al obtener la configuración." };
  }
}

/**
 * Guarda o actualiza la configuración de vacaciones de un empleado.
 * Solo ADMIN y RRHH pueden ejecutar esta acción.
 */
export async function setConfiguracionVacaciones(
  legajoId: string,
  diasDisponibles: number,
  secretarioGeneral: string
): Promise<ActionResult> {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false, error: "Debés iniciar sesión." };
    }

    const roles = (session.user as { roles?: string[] }).roles ?? [];
    if (!esAdmin(roles)) {
      return { success: false, error: "No tenés permisos para realizar esta acción." };
    }

    const parsed = setConfigSchema.safeParse({
      legajoId,
      diasDisponibles,
      secretarioGeneral,
    });
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message ?? "Datos inválidos.",
      };
    }

    await prisma.configuracionVacaciones.upsert({
      where: { legajoId: parsed.data.legajoId },
      create: {
        legajoId: parsed.data.legajoId,
        diasDisponibles: parsed.data.diasDisponibles,
        secretarioGeneral: parsed.data.secretarioGeneral,
      },
      update: {
        diasDisponibles: parsed.data.diasDisponibles,
        secretarioGeneral: parsed.data.secretarioGeneral,
      },
    });

    return { success: true, data: undefined };
  } catch {
    return { success: false, error: "Error al guardar la configuración." };
  }
}

/**
 * Calcula días restantes considerando solicitudes PENDIENTE y APROBADA.
 */
async function calcularDiasRestantes(
  legajoId: string,
  excluirSolicitudId?: number
): Promise<number> {
  const config = await prisma.configuracionVacaciones.findUnique({
    where: { legajoId },
  });
  if (!config) return 0;

  const solicitudes = await prisma.solicitudVacaciones.findMany({
    where: {
      legajoId,
      estado: { in: [EstadoVacaciones.PENDIENTE, EstadoVacaciones.APROBADA] },
      ...(excluirSolicitudId ? { id: { not: excluirSolicitudId } } : {}),
    },
  });

  const totalUsado = solicitudes.reduce((sum, s) => sum + s.diasSolicitados, 0);
  return config.diasDisponibles - totalUsado;
}

export type EstadoConfigVacaciones = "sin_legajo" | "sin_config" | "ok";

/**
 * Obtiene la configuración de vacaciones del usuario actual (según su legajo).
 * Retorna estado diferenciado: sin_legajo, sin_config, o ok.
 */
export async function getMiConfiguracionVacaciones(): Promise<
  | { success: true; estado: "sin_legajo"; data: null }
  | { success: true; estado: "sin_config"; data: { legajoId: string } }
  | {
      success: true;
      estado: "ok";
      data: {
        legajoId: string;
        diasDisponibles: number;
        diasUtilizados: number;
        diasRestantes: number;
        secretarioGeneral: string;
      };
    }
  | { success: false; error: string }
> {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false, error: "Debés iniciar sesión." };
    }

    const legajoId = (session.user as { legajoId?: string }).legajoId;
    if (!legajoId) {
      return { success: true, estado: "sin_legajo", data: null };
    }

    const config = await prisma.configuracionVacaciones.findUnique({
      where: { legajoId },
    });

    if (!config) {
      return { success: true, estado: "sin_config", data: { legajoId } };
    }

    const solicitudes = await prisma.solicitudVacaciones.findMany({
      where: {
        legajoId,
        estado: { in: [EstadoVacaciones.PENDIENTE, EstadoVacaciones.APROBADA] },
      },
    });
    const diasUtilizados = solicitudes.reduce((sum, s) => sum + s.diasSolicitados, 0);
    const diasRestantes = config.diasDisponibles - diasUtilizados;

    return {
      success: true,
      estado: "ok",
      data: {
        legajoId,
        diasDisponibles: config.diasDisponibles,
        diasUtilizados,
        diasRestantes,
        secretarioGeneral: config.secretarioGeneral,
      },
    };
  } catch {
    return { success: false, error: "Error al obtener la configuración." };
  }
}

/**
 * Obtiene las solicitudes de vacaciones.
 * Usuarios no admin solo acceden a las propias (legajoId debe coincidir con session.user.legajoId).
 * ADMIN y RRHH acceden a las de cualquier empleado.
 */
export async function getSolicitudesVacaciones(
  legajoId: string
): Promise<
  ActionResult<
    Array<{
      id: number;
      fechaDesde: Date;
      fechaHasta: Date;
      diasSolicitados: number;
      diasRestantes: number;
      estado: EstadoVacaciones;
    }>
  >
> {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false, error: "Debés iniciar sesión." };
    }

    const parsed = legajoIdSchema.safeParse(legajoId);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
    }

    const userLegajoId = (session.user as { legajoId?: string }).legajoId;
    const roles = (session.user as { roles?: string[] }).roles ?? [];

    if (!esAdmin(roles) && userLegajoId !== parsed.data) {
      return {
        success: false,
        error: "No tenés permisos para ver las solicitudes de otro empleado.",
      };
    }

    const solicitudes = await prisma.solicitudVacaciones.findMany({
      where: { legajoId: parsed.data },
      orderBy: { fechaDesde: "desc" },
      select: {
        id: true,
        fechaDesde: true,
        fechaHasta: true,
        diasSolicitados: true,
        diasRestantes: true,
        estado: true,
      },
    });

    return {
      success: true,
      data: solicitudes.map((s) => ({
        id: s.id,
        fechaDesde: s.fechaDesde,
        fechaHasta: s.fechaHasta,
        diasSolicitados: s.diasSolicitados,
        diasRestantes: s.diasRestantes,
        estado: s.estado,
      })),
    };
  } catch {
    return { success: false, error: "Error al obtener las solicitudes." };
  }
}

/**
 * Crea una nueva solicitud de vacaciones.
 * Valida que haya días suficientes antes de crear.
 */
export async function crearSolicitudVacaciones(
  legajoId: string,
  fechaDesde: Date,
  fechaHasta: Date
): Promise<
  ActionResult<{
    id: number;
    diasSolicitados: number;
    diasRestantes: number;
  }>
> {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false, error: "Debés iniciar sesión." };
    }

    const parsed = crearSolicitudSchema.safeParse({
      legajoId,
      fechaDesde,
      fechaHasta,
    });
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message ?? "Datos inválidos.",
      };
    }

    const userLegajoId = (session.user as { legajoId?: string }).legajoId;
    const roles = (session.user as { roles?: string[] }).roles ?? [];

    if (!esAdmin(roles) && userLegajoId !== parsed.data.legajoId) {
      return {
        success: false,
        error: "No tenés permisos para crear solicitudes para otro empleado.",
      };
    }

    if (parsed.data.fechaHasta < parsed.data.fechaDesde) {
      return {
        success: false,
        error: "La fecha hasta debe ser posterior o igual a la fecha desde.",
      };
    }

    const diasSolicitados = calcularDiasVacaciones(
      parsed.data.fechaDesde,
      parsed.data.fechaHasta
    );
    const diasRestantesAntes = await calcularDiasRestantes(parsed.data.legajoId);
    const diasRestantes = diasRestantesAntes - diasSolicitados;

    if (diasRestantes < 0) {
      return {
        success: false,
        error: "No tenés días suficientes disponibles para este período.",
      };
    }

    const config = await prisma.configuracionVacaciones.findUnique({
      where: { legajoId: parsed.data.legajoId },
    });
    if (!config) {
      return {
        success: false,
        error: "El empleado no tiene configuración de vacaciones cargada.",
      };
    }

    const solicitud = await prisma.solicitudVacaciones.create({
      data: {
        legajoId: parsed.data.legajoId,
        fechaDesde: parsed.data.fechaDesde,
        fechaHasta: parsed.data.fechaHasta,
        diasSolicitados,
        diasRestantes,
        estado: EstadoVacaciones.PENDIENTE,
      },
    });

    return {
      success: true,
      data: {
        id: solicitud.id,
        diasSolicitados: solicitud.diasSolicitados,
        diasRestantes: solicitud.diasRestantes,
      },
    };
  } catch {
    return { success: false, error: "Error al crear la solicitud." };
  }
}

/**
 * Edita una solicitud de vacaciones (solo si estado === PENDIENTE).
 * Recalcula días automáticamente.
 */
export async function editarSolicitudVacaciones(
  solicitudId: number,
  fechaDesde: Date,
  fechaHasta: Date
): Promise<
  ActionResult<{
    diasSolicitados: number;
    diasRestantes: number;
  }>
> {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false, error: "Debés iniciar sesión." };
    }

    const parsed = editarSolicitudSchema.safeParse({
      solicitudId,
      fechaDesde,
      fechaHasta,
    });
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message ?? "Datos inválidos.",
      };
    }

    const solicitud = await prisma.solicitudVacaciones.findUnique({
      where: { id: parsed.data.solicitudId },
    });

    if (!solicitud) {
      return { success: false, error: "Solicitud no encontrada." };
    }

    if (solicitud.estado !== EstadoVacaciones.PENDIENTE) {
      return {
        success: false,
        error: "Solo se pueden editar solicitudes en estado PENDIENTE.",
      };
    }

    const userLegajoId = (session.user as { legajoId?: string }).legajoId;
    const roles = (session.user as { roles?: string[] }).roles ?? [];

    if (!esAdmin(roles) && solicitud.legajoId !== userLegajoId) {
      return {
        success: false,
        error: "No tenés permisos para editar esta solicitud.",
      };
    }

    if (parsed.data.fechaHasta < parsed.data.fechaDesde) {
      return {
        success: false,
        error: "La fecha hasta debe ser posterior o igual a la fecha desde.",
      };
    }

    const diasSolicitados = calcularDiasVacaciones(
      parsed.data.fechaDesde,
      parsed.data.fechaHasta
    );
    const diasRestantes = await calcularDiasRestantes(
      solicitud.legajoId,
      solicitud.id
    );
    const nuevosRestantes = diasRestantes - diasSolicitados;

    if (nuevosRestantes < 0) {
      return {
        success: false,
        error: "No tenés días suficientes disponibles para este período.",
      };
    }

    await prisma.solicitudVacaciones.update({
      where: { id: solicitud.id },
      data: {
        fechaDesde: parsed.data.fechaDesde,
        fechaHasta: parsed.data.fechaHasta,
        diasSolicitados,
        diasRestantes: nuevosRestantes,
      },
    });

    return {
      success: true,
      data: {
        diasSolicitados,
        diasRestantes: nuevosRestantes,
      },
    };
  } catch {
    return { success: false, error: "Error al editar la solicitud." };
  }
}

/**
 * Aprueba una solicitud de vacaciones (PENDIENTE → APROBADA).
 * Solo ADMIN y RRHH pueden ejecutar esta acción.
 */
export async function aprobarSolicitudVacaciones(
  solicitudId: number
): Promise<ActionResult> {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false, error: "Debés iniciar sesión." };
    }

    const roles = (session.user as { roles?: string[] }).roles ?? [];
    if (!esAdmin(roles)) {
      return {
        success: false,
        error: "Solo ADMIN o RRHH pueden aprobar solicitudes.",
      };
    }

    const parsed = solicitudIdSchema.safeParse(solicitudId);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message ?? "Datos inválidos.",
      };
    }

    const solicitud = await prisma.solicitudVacaciones.findUnique({
      where: { id: parsed.data },
    });

    if (!solicitud) {
      return { success: false, error: "Solicitud no encontrada." };
    }

    if (solicitud.estado !== EstadoVacaciones.PENDIENTE) {
      return {
        success: false,
        error:
          solicitud.estado === EstadoVacaciones.APROBADA
            ? "La solicitud ya está aprobada."
            : "No se puede aprobar una solicitud dada de baja.",
      };
    }

    const empleadoUsuario = await prisma.user.findFirst({
      where: { legajoId: solicitud.legajoId },
      select: { id: true },
    });

    const desdeStr = formatearFecha(solicitud.fechaDesde);
    const hastaStr = formatearFecha(solicitud.fechaHasta);
    const diasStr = String(solicitud.diasSolicitados);

    const observacion = `${formatearFecha(solicitud.fechaDesde)} al ${formatearFecha(solicitud.fechaHasta)}`;
    const periodoNombre =
      `${solicitud.fechaDesde.getFullYear()}-${String(solicitud.fechaDesde.getMonth() + 1).padStart(2, "0")}__NOVEDADES`;

    await prisma.$transaction(async (tx) => {
      await tx.solicitudVacaciones.update({
        where: { id: solicitud.id },
        data: { estado: EstadoVacaciones.APROBADA },
      });
      await tx.novedadLiquidacion.upsert({
        where: {
          legajoId_tipo_fechaDesde: {
            legajoId: solicitud.legajoId,
            tipo: "VACACIONES",
            fechaDesde: solicitud.fechaDesde,
          },
        },
        update: {
          fechaHasta: solicitud.fechaHasta,
          diasTotal: solicitud.diasSolicitados,
          observacion,
          periodoNombre,
          liquidado: false,
        },
        create: {
          legajoId: solicitud.legajoId,
          tipo: "VACACIONES",
          codigo: 2501,
          fechaDesde: solicitud.fechaDesde,
          fechaHasta: solicitud.fechaHasta,
          diasTotal: solicitud.diasSolicitados,
          observacion,
          periodoNombre,
          liquidado: false,
        },
      });
    });

    if (empleadoUsuario) {
      try {
        await prisma.notificacion.create({
          data: {
            usuarioId: empleadoUsuario.id,
            tipo: TipoNotificacion.VACACIONES_APROBADA,
            titulo: "Vacaciones aprobadas ✓",
            mensaje: `Tu solicitud del ${desdeStr} al ${hastaStr} (${diasStr} días) fue aprobada.`,
            solicitudId: solicitud.id,
          },
        });
      } catch (notifErr) {
        console.error("[aprobarSolicitudVacaciones] Error creando notificación:", notifErr);
        // La aprobación ya se realizó; no fallar por la notificación
      }
    }

    return { success: true, data: undefined };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[aprobarSolicitudVacaciones]", e);
    return {
      success: false,
      error: process.env.NODE_ENV === "development" ? `Error al aprobar: ${msg}` : "Error al aprobar la solicitud.",
    };
  }
}

/**
 * Da de baja una solicitud (cambia estado a BAJA).
 * Si la solicitud estaba APROBADA, devuelve los días a ConfiguracionVacaciones.
 * Crea notificaciones según quién ejecuta y el estado anterior.
 */
export async function darDeBajaSolicitud(
  solicitudId: number
): Promise<ActionResult<{ diasDevolver?: number }>> {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false, error: "Debés iniciar sesión." };
    }

    const parsed = solicitudIdSchema.safeParse(solicitudId);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message ?? "Datos inválidos.",
      };
    }

    const solicitud = await prisma.solicitudVacaciones.findUnique({
      where: { id: parsed.data },
      include: { legajo: true },
    });

    if (!solicitud) {
      return { success: false, error: "Solicitud no encontrada." };
    }

    if (solicitud.estado === EstadoVacaciones.BAJA) {
      return { success: false, error: "La solicitud ya está dada de baja." };
    }

    const userLegajoId = (session.user as { legajoId?: string }).legajoId;
    const roles = (session.user as { roles?: string[] }).roles ?? [];
    const esAdminRol = esAdmin(roles);
    const esPropia = solicitud.legajoId === userLegajoId;

    // APROBADA → BAJA: solo ADMIN o RRHH
    if (solicitud.estado === EstadoVacaciones.APROBADA && !esAdminRol) {
      return {
        success: false,
        error: "No podés cancelar una solicitud ya aprobada. Contactá a RRHH.",
      };
    }

    // PENDIENTE → BAJA: el propio empleado, ADMIN o RRHH
    if (solicitud.estado === EstadoVacaciones.PENDIENTE && !esPropia && !esAdminRol) {
      return {
        success: false,
        error: "No tenés permisos para dar de baja esta solicitud.",
      };
    }

    // Obtener usuario del empleado (destinatario de la notificación)
    const empleadoUsuario = await prisma.user.findFirst({
      where: { legajoId: solicitud.legajoId },
      select: { id: true },
    });

    const desdeStr = formatearFecha(solicitud.fechaDesde);
    const hastaStr = formatearFecha(solicitud.fechaHasta);
    const diasStr = String(solicitud.diasSolicitados);

    const resultado = await prisma.$transaction(async (tx) => {
      if (solicitud.estado === EstadoVacaciones.APROBADA) {
        // Devolver días al saldo del empleado
        const config = await tx.configuracionVacaciones.findUnique({
          where: { legajoId: solicitud.legajoId },
        });
        if (config) {
          await tx.configuracionVacaciones.update({
            where: { legajoId: solicitud.legajoId },
            data: {
              diasDisponibles: config.diasDisponibles + solicitud.diasSolicitados,
            },
          });
        }

        await tx.solicitudVacaciones.update({
          where: { id: solicitud.id },
          data: { estado: EstadoVacaciones.BAJA },
        });

        await tx.novedadLiquidacion.deleteMany({
          where: {
            legajoId: solicitud.legajoId,
            tipo: "VACACIONES",
            fechaDesde: solicitud.fechaDesde,
          },
        });

        const nuevoSaldo = config
          ? config.diasDisponibles + solicitud.diasSolicitados
          : solicitud.diasSolicitados;
        return { diasDevolver: solicitud.diasSolicitados, nuevoSaldo };
      }

      // PENDIENTE → BAJA
      await tx.solicitudVacaciones.update({
        where: { id: solicitud.id },
        data: { estado: EstadoVacaciones.BAJA },
      });

      return { diasDevolver: undefined as number | undefined, nuevoSaldo: undefined as number | undefined };
    });

    // Notificaciones fuera de la transacción (tx.notificacion no está disponible)
    if (empleadoUsuario) {
      try {
        if (solicitud.estado === EstadoVacaciones.APROBADA && resultado.nuevoSaldo != null) {
          const nuevoSaldo = resultado.nuevoSaldo;
          await prisma.notificacion.create({
            data: {
              usuarioId: empleadoUsuario.id,
              tipo: TipoNotificacion.VACACIONES_BAJA_APROBADA,
              titulo: "Vacaciones canceladas — días devueltos 🔄",
              mensaje: `Tu solicitud aprobada del ${desdeStr} al ${hastaStr} fue cancelada. Se te devolvieron ${diasStr} días. Nuevo saldo: ${nuevoSaldo} días disponibles.`,
              solicitudId: solicitud.id,
            },
          });
        } else if (esAdminRol) {
          await prisma.notificacion.create({
            data: {
              usuarioId: empleadoUsuario.id,
              tipo: TipoNotificacion.VACACIONES_BAJA,
              titulo: "Solicitud de vacaciones cancelada",
              mensaje: `Tu solicitud del ${desdeStr} al ${hastaStr} fue cancelada.`,
              solicitudId: solicitud.id,
            },
          });
        }
      } catch (notifErr) {
        console.error("[darDeBajaSolicitud] Error creando notificación:", notifErr);
        // La baja ya se realizó correctamente; no fallar por la notificación
      }
    }

    return { success: true, data: resultado };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[darDeBajaSolicitud]", e);
    return {
      success: false,
      error: process.env.NODE_ENV === "development" ? `Error al dar de baja la solicitud: ${msg}` : "Error al dar de baja la solicitud.",
    };
  }
}

/**
 * Lista usuarios con su legajo vinculado (para pantalla de vinculación).
 * Solo ADMIN y RRHH.
 */
export async function getUsuariosParaVinculacion(): Promise<
  ActionResult<
    Array<{
      id: string;
      nombre: string;
      email: string;
      legajoId: string | null;
      legajo: { id: string; numeroLegajo: number; label: string } | null;
    }>
  >
> {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false, error: "Debés iniciar sesión." };
    }
    const roles = (session.user as { roles?: string[] }).roles ?? [];
    if (!esAdmin(roles)) {
      return { success: false, error: "No tenés permisos." };
    }

    const users = await prisma.user.findMany({
      select: {
        id: true,
        nombre: true,
        apellido: true,
        email: true,
        legajoId: true,
        legajo: { select: { id: true, numeroLegajo: true, apellidos: true, nombres: true } },
      },
      orderBy: { nombre: "asc" },
    });

    return {
      success: true,
      data: users.map((u) => ({
        id: u.id,
        nombre: `${u.nombre} ${u.apellido}`,
        email: u.email,
        legajoId: u.legajoId,
        legajo: u.legajo
          ? { id: u.legajo.id, numeroLegajo: u.legajo.numeroLegajo, label: `${u.legajo.apellidos}, ${u.legajo.nombres} (Leg. ${u.legajo.numeroLegajo})` }
          : null,
      })),
    };
  } catch {
    return { success: false, error: "Error al obtener usuarios." };
  }
}

/**
 * Vincula un usuario a un legajo (user.legajoId = legajo.id).
 * Solo ADMIN y RRHH.
 */
export async function vincularUsuarioLegajo(
  userId: string,
  legajoId: string
): Promise<ActionResult> {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false, error: "Debés iniciar sesión." };
    }
    const roles = (session.user as { roles?: string[] }).roles ?? [];
    if (!esAdmin(roles)) {
      return { success: false, error: "No tenés permisos." };
    }

    const parsed = vincularSchema.safeParse({ userId, legajoId });
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
    }

    const legajo = await prisma.legajo.findUnique({
      where: { id: parsed.data.legajoId },
    });
    if (!legajo) {
      return { success: false, error: "Legajo no encontrado." };
    }

    await prisma.user.update({
      where: { id: parsed.data.userId },
      data: { legajoId: parsed.data.legajoId },
    });

    return { success: true, data: undefined };
  } catch {
    return { success: false, error: "Error al vincular." };
  }
}

/**
 * Desvincula un usuario de su legajo.
 * Solo ADMIN y RRHH.
 */
export async function desvincularUsuarioLegajo(userId: string): Promise<ActionResult> {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false, error: "Debés iniciar sesión." };
    }
    const roles = (session.user as { roles?: string[] }).roles ?? [];
    if (!esAdmin(roles)) {
      return { success: false, error: "No tenés permisos." };
    }

    await prisma.user.update({
      where: { id: userId },
      data: { legajoId: null },
    });

    return { success: true, data: undefined };
  } catch {
    return { success: false, error: "Error al desvincular." };
  }
}

// === HISTORIAL DE VACACIONES ===

export interface TotalesAnio {
  anio: number;
  diasDisponibles: number | null;
  diasPendientes: number;
  diasAprobados: number;
  diasBaja: number;
  diasUsados: number;
  diasRestantes: number | null;
}

export interface HistorialParams {
  legajoId?: string;
  anio?: number;
  estado?: EstadoVacaciones | "TODOS";
}

export interface SolicitudHistorial {
  id: number;
  legajoId: string;
  fechaDesde: Date;
  fechaHasta: Date;
  diasSolicitados: number;
  diasRestantes: number;
  estado: EstadoVacaciones;
}

export interface HistorialResult {
  solicitudes: SolicitudHistorial[];
  totalesPorAnio: TotalesAnio[];
  aniosDisponibles: number[];
}

const histAnioSchema = z.number().int().min(2000).max(2100).optional();
const histEstadoSchema = z.enum(["PENDIENTE", "APROBADA", "BAJA", "TODOS"]).optional();

/**
 * Obtiene los años únicos que tienen solicitudes para un legajo.
 * Si no se pasa legajoId, usa el del usuario de sesión.
 * Solo ADMIN/RRHH pueden consultar otro legajo.
 */
export async function getAniosConSolicitudes(
  legajoId?: string
): Promise<ActionResult<number[]>> {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false, error: "Debés iniciar sesión." };
    }

    const userLegajoId = (session.user as { legajoId?: string }).legajoId;
    const roles = (session.user as { roles?: string[] }).roles ?? [];
    const esAdminRol = esAdmin(roles);

    let legajoFinal: string;
    if (legajoId) {
      if (!esAdminRol && legajoId !== userLegajoId) {
        return { success: false, error: "No tenés permisos para consultar el historial de otro empleado." };
      }
      legajoFinal = legajoId;
    } else {
      if (!userLegajoId) {
        return { success: false, error: "Tu usuario no está vinculado a un legajo." };
      }
      legajoFinal = userLegajoId;
    }

    const solicitudes = await prisma.solicitudVacaciones.findMany({
      where: { legajoId: legajoFinal },
      select: { fechaDesde: true },
    });

    const anios = [...new Set(solicitudes.map((s) => new Date(s.fechaDesde).getFullYear()))];
    anios.sort((a, b) => b - a);

    return { success: true, data: anios };
  } catch {
    return { success: false, error: "Error al obtener años con solicitudes." };
  }
}

/**
 * Obtiene el historial de vacaciones con filtros y totales por año.
 */
export async function getHistorialVacaciones(
  params: HistorialParams
): Promise<ActionResult<HistorialResult>> {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false, error: "Debés iniciar sesión." };
    }

    const userLegajoId = (session.user as { legajoId?: string }).legajoId;
    const roles = (session.user as { roles?: string[] }).roles ?? [];
    const esAdminRol = esAdmin(roles);

    let legajoFinal: string;
    if (params.legajoId) {
      if (!esAdminRol && params.legajoId !== userLegajoId) {
        return { success: false, error: "No tenés permisos para consultar el historial de otro empleado." };
      }
      legajoFinal = params.legajoId;
    } else {
      if (!userLegajoId) {
        return { success: false, error: "Tu usuario no está vinculado a un legajo." };
      }
      legajoFinal = userLegajoId;
    }

    const anioParsed = histAnioSchema.safeParse(params.anio);
    const estadoParsed = histEstadoSchema.safeParse(params.estado ?? "TODOS");
    const anio = anioParsed.success ? anioParsed.data : undefined;
    const estadoFiltro = estadoParsed.success ? estadoParsed.data : "TODOS";

    const whereClause: {
      legajoId: string;
      fechaDesde?: { gte: Date; lte: Date };
      estado?: EstadoVacaciones;
    } = {
      legajoId: legajoFinal,
    };

    if (anio !== undefined) {
      const inicioAnio = new Date(anio, 0, 1);
      const finAnio = new Date(anio, 11, 31, 23, 59, 59, 999);
      whereClause.fechaDesde = { gte: inicioAnio, lte: finAnio };
    }

    if (estadoFiltro !== "TODOS") {
      whereClause.estado = estadoFiltro as EstadoVacaciones;
    }

    const solicitudes = await prisma.solicitudVacaciones.findMany({
      where: whereClause,
      orderBy: { fechaDesde: "desc" },
      select: {
        id: true,
        legajoId: true,
        fechaDesde: true,
        fechaHasta: true,
        diasSolicitados: true,
        diasRestantes: true,
        estado: true,
      },
    });

    const aniosConSolicitudes = [
      ...new Set(solicitudes.map((s) => new Date(s.fechaDesde).getFullYear())),
    ];
    aniosConSolicitudes.sort((a, b) => b - a);

    const anioActual = new Date().getFullYear();
    let configActual: { diasDisponibles: number } | null = null;
    if (aniosConSolicitudes.includes(anioActual)) {
      const config = await prisma.configuracionVacaciones.findUnique({
        where: { legajoId: legajoFinal },
        select: { diasDisponibles: true },
      });
      configActual = config;
    }

    const totalesPorAnio: TotalesAnio[] = aniosConSolicitudes.map((anioItem) => {
      const delAnio = solicitudes.filter(
        (s) => new Date(s.fechaDesde).getFullYear() === anioItem
      );
      const diasPendientes = delAnio
        .filter((s) => s.estado === EstadoVacaciones.PENDIENTE)
        .reduce((sum, s) => sum + s.diasSolicitados, 0);
      const diasAprobados = delAnio
        .filter((s) => s.estado === EstadoVacaciones.APROBADA)
        .reduce((sum, s) => sum + s.diasSolicitados, 0);
      const diasBaja = delAnio
        .filter((s) => s.estado === EstadoVacaciones.BAJA)
        .reduce((sum, s) => sum + s.diasSolicitados, 0);
      const diasUsados = diasPendientes + diasAprobados;

      const esAnioActual = anioItem === anioActual;
      const diasDisponibles = esAnioActual && configActual ? configActual.diasDisponibles : null;
      const diasRestantes =
        diasDisponibles !== null ? diasDisponibles - diasUsados : null;

      return {
        anio: anioItem,
        diasDisponibles,
        diasPendientes,
        diasAprobados,
        diasBaja,
        diasUsados,
        diasRestantes,
      };
    });

    return {
      success: true,
      data: {
        solicitudes: solicitudes.map((s) => ({
          id: s.id,
          legajoId: s.legajoId,
          fechaDesde: s.fechaDesde,
          fechaHasta: s.fechaHasta,
          diasSolicitados: s.diasSolicitados,
          diasRestantes: s.diasRestantes,
          estado: s.estado,
        })),
        totalesPorAnio,
        aniosDisponibles: aniosConSolicitudes,
      },
    };
  } catch {
    return { success: false, error: "Error al obtener el historial de vacaciones." };
  }
}
