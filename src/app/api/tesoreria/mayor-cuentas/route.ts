import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  insertMayorCuenta,
  listMayorCuentas,
  nextOrdenMayorCuenta,
} from "@/lib/tesoreria/mayorRawQueries";

const ROLES = ["ADMIN", "TESORERO", "SUPER_ADMIN"] as const;

function canAccess(roles: string[]) {
  return ROLES.some((r) => roles.includes(r));
}

function serialize(c: { id: number; nombre: string; orden: number; createdAt: Date }) {
  return {
    id: c.id,
    nombre: c.nombre,
    orden: c.orden,
    createdAt: c.createdAt.toISOString(),
  };
}

/** GET — listar cuentas ordenadas */
export async function GET() {
  const session = await auth();
  const roles = (session?.user as { roles?: string[] })?.roles ?? [];
  if (!canAccess(roles)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  try {
    const rows = await listMayorCuentas();
    return NextResponse.json(rows.map(serialize));
  } catch (err) {
    console.error("mayor-cuentas GET:", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Error al listar (¿migración aplicada?)",
      },
      { status: 500 }
    );
  }
}

/** POST — crear cuenta */
export async function POST(req: NextRequest) {
  const session = await auth();
  const roles = (session?.user as { roles?: string[] })?.roles ?? [];
  if (!canAccess(roles)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  let body: { nombre?: string; orden?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
  }

  const nombre = (body.nombre ?? "").trim();
  if (!nombre) {
    return NextResponse.json({ error: "nombre es obligatorio" }, { status: 400 });
  }

  let orden = body.orden;
  if (orden == null || Number.isNaN(Number(orden))) {
    orden = await nextOrdenMayorCuenta();
  }

  try {
    const creado = await insertMayorCuenta(nombre, Number(orden));
    return NextResponse.json(serialize(creado));
  } catch (err) {
    console.error("mayor-cuentas POST:", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Error al crear (¿tabla mayor_cuentas existe?)",
      },
      { status: 500 }
    );
  }
}
