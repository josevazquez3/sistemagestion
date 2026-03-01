import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { registrarAuditoria } from "@/lib/auditoria";

const ROLES = ["ADMIN", "SECRETARIA"] as const;

function canAccess(roles: string[]) {
  return ROLES.some((r) => roles.includes(r));
}

/** POST - Registrar en auditoría "Cargó X actas de forma masiva" */
export async function POST(req: NextRequest) {
  const session = await auth();
  const roles = (session?.user as { roles?: string[] })?.roles ?? [];
  if (!canAccess(roles)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  let body: { cantidad?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Cuerpo JSON inválido" },
      { status: 400 }
    );
  }

  const cantidad = Number(body.cantidad);
  if (!Number.isInteger(cantidad) || cantidad < 1) {
    return NextResponse.json(
      { error: "cantidad debe ser un entero positivo" },
      { status: 400 }
    );
  }

  const user = session?.user as {
    id?: string;
    name?: string;
    email?: string;
  };
  await registrarAuditoria({
    userId: user?.id ?? "",
    userNombre: user?.name ?? "",
    userEmail: user?.email ?? "",
    accion: `Cargó ${cantidad} actas de forma masiva`,
    modulo: "Secretaría",
    ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? undefined,
  });

  return NextResponse.json({ ok: true });
}
