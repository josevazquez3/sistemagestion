import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  insertCuitDistrito,
  listCuitDistritos,
} from "@/lib/tesoreria/cuitDistritosQueries";

const ROLES = ["ADMIN", "TESORERO", "SUPER_ADMIN"] as const;

function canAccess(roles: string[]) {
  return ROLES.some((r) => roles.includes(r));
}

function mapRow(r: { id: number; distrito: string; cuit: string; createdAt: Date }) {
  return {
    id: r.id,
    distrito: r.distrito,
    cuit: r.cuit,
    createdAt: r.createdAt.toISOString(),
  };
}

/** GET - Lista todos los CUIT por distrito */
export async function GET() {
  const session = await auth();
  const roles = (session?.user as { roles?: string[] })?.roles ?? [];
  if (!canAccess(roles)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  try {
    const rows = await listCuitDistritos();
    return NextResponse.json(rows.map(mapRow));
  } catch (err) {
    console.error("cuit-distritos GET:", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Error al listar (¿migración aplicada y BD disponible?)",
      },
      { status: 500 }
    );
  }
}

/** POST - Crear { distrito, cuit } */
export async function POST(req: NextRequest) {
  const session = await auth();
  const roles = (session?.user as { roles?: string[] })?.roles ?? [];
  if (!canAccess(roles)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  let body: { distrito?: string; cuit?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
  }

  const distrito = (body.distrito ?? "").trim();
  const cuit = (body.cuit ?? "").trim();
  if (!distrito || !cuit) {
    return NextResponse.json(
      { error: "distrito y cuit son obligatorios" },
      { status: 400 }
    );
  }

  try {
    const creado = await insertCuitDistrito(distrito, cuit);
    return NextResponse.json(mapRow(creado));
  } catch (err) {
    console.error("cuit-distritos POST:", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Error al crear (¿tabla cuit_distritos existe?)",
      },
      { status: 500 }
    );
  }
}
