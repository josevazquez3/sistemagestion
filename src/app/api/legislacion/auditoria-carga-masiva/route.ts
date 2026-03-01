import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { registrarAuditoria } from "@/lib/auditoria";

const ROLES_WRITE = ["ADMIN", "SECRETARIA"] as const;

function canWrite(roles: string[]) {
  return ROLES_WRITE.some((r) => roles.includes(r));
}

/** POST - Registrar "Cargó X documentos de legislación de forma masiva" */
export async function POST(req: NextRequest) {
  const session = await auth();
  const roles = (session?.user as { roles?: string[] })?.roles ?? [];
  if (!canWrite(roles)) {
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

  const user = session?.user as { id?: string; name?: string; email?: string };
  await registrarAuditoria({
    userId: user?.id ?? "",
    userNombre: user?.name ?? "",
    userEmail: user?.email ?? "",
    accion: `Cargó ${cantidad} documentos de legislación de forma masiva`,
    modulo: "Legislación",
    ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? undefined,
  });

  return NextResponse.json({ ok: true });
}
