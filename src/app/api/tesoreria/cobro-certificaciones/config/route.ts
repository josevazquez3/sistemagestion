import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { registrarAuditoria } from "@/lib/auditoria";

const ROLES = ["ADMIN", "TESORERO", "SUPER_ADMIN"] as const;

function canAccess(roles: string[]) {
  return ROLES.some((r) => roles.includes(r));
}

/** GET - Obtener config por mes/anio (codigosOperativos) */
export async function GET(req: NextRequest) {
  const session = await auth();
  const roles = (session?.user as { roles?: string[] })?.roles ?? [];
  if (!canAccess(roles)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const mes = parseInt(searchParams.get("mes") ?? "0", 10);
  const anio = parseInt(searchParams.get("anio") ?? "0", 10);

  if (!mes || !anio || mes < 1 || mes > 12) {
    return NextResponse.json({ error: "mes y anio son obligatorios (mes 1-12)" }, { status: 400 });
  }

  const config = await prisma.configCobroCertificacion.findUnique({
    where: { mes_anio: { mes, anio } },
  });

  if (!config) {
    return NextResponse.json({
      mes,
      anio,
      codigosOperativos: [],
    });
  }

  return NextResponse.json({
    ...config,
    codigosOperativos: config.codigosOperativos ?? [],
  });
}

/** PUT - Crear o actualizar config (codigosOperativos: string[]) */
export async function PUT(req: NextRequest) {
  const session = await auth();
  const roles = (session?.user as { roles?: string[] })?.roles ?? [];
  if (!canAccess(roles)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  let body: { mes?: number; anio?: number; codigosOperativos?: string[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
  }

  const mes = body.mes ?? 0;
  const anio = body.anio ?? 0;
  if (!mes || !anio || mes < 1 || mes > 12) {
    return NextResponse.json({ error: "mes y anio son obligatorios (mes 1-12)" }, { status: 400 });
  }

  const codigosOperativos = Array.isArray(body.codigosOperativos)
    ? body.codigosOperativos.map((c) => String(c).trim()).filter(Boolean)
    : [];

  const config = await prisma.configCobroCertificacion.upsert({
    where: { mes_anio: { mes, anio } },
    create: { mes, anio, codigosOperativos },
    update: { codigosOperativos },
  });

  const user = session?.user as { id?: string; name?: string; email?: string };
  try {
    if (codigosOperativos.length > 0) {
      await registrarAuditoria({
        userId: user?.id ?? "",
        userNombre: user?.name ?? "",
        userEmail: user?.email ?? "",
        accion: `Configuró códigos operativos Cobro Certificaciones (${mes}/${anio}): ${codigosOperativos.join(", ")}`,
        modulo: "Tesorería",
      });
    }
  } catch {}

  return NextResponse.json({
    ...config,
    codigosOperativos: config.codigosOperativos ?? [],
  });
}
