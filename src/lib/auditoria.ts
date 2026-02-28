import { prisma } from "@/lib/prisma";

export async function registrarAuditoria({
  userId,
  userNombre,
  userEmail,
  accion,
  modulo,
  detalle,
  ip,
}: {
  userId: string;
  userNombre: string;
  userEmail: string;
  accion: string;
  modulo: string;
  detalle?: string;
  ip?: string;
}) {
  try {
    await prisma.auditoriaLog.create({
      data: { userId, userNombre, userEmail, accion, modulo, detalle, ip },
    });
  } catch {
    // No romper la operación principal si falla el log
  }
}
