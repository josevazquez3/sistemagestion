import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const ROLES = ["SUPER_ADMIN", "ADMIN", "TESORERO"] as const;

function canAccess(roles: string[]) {
  return ROLES.some((r) => roles.includes(r));
}

export async function GET(req: NextRequest) {
  const session = await auth();
  const roles = (session?.user as { roles?: string[] })?.roles ?? [];
  if (!canAccess(roles)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search")?.trim();

  const data = await prisma.proveedor.findMany({
    where: search
      ? {
          OR: [
            { proveedor: { contains: search, mode: "insensitive" } },
            { nombreContacto: { contains: search, mode: "insensitive" } },
            { alias: { contains: search, mode: "insensitive" } },
            { cuit: { contains: search, mode: "insensitive" } },
            { cbu: { contains: search, mode: "insensitive" } },
            { banco: { contains: search, mode: "insensitive" } },
            { email: { contains: search, mode: "insensitive" } },
          ],
        }
      : undefined,
    orderBy: { proveedor: "asc" },
  });
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  const roles = (session?.user as { roles?: string[] })?.roles ?? [];
  if (!canAccess(roles)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const proveedor = String(body?.proveedor ?? "").trim();
    if (!proveedor) {
      return NextResponse.json({ error: "El campo Proveedor es obligatorio." }, { status: 400 });
    }

    const created = await prisma.proveedor.create({
      data: {
        proveedor,
        nombreContacto: body?.nombreContacto?.trim() || null,
        alias: body?.alias?.trim() || null,
        cuit: body?.cuit?.trim() || null,
        cuentaDebitoTipoNum: body?.cuentaDebitoTipoNum?.trim() || null,
        banco: body?.banco?.trim() || null,
        direccion: body?.direccion?.trim() || null,
        ciudad: body?.ciudad?.trim() || null,
        telefono: body?.telefono?.trim() || null,
        email: body?.email?.trim() || null,
        formaPago: body?.formaPago?.trim() || null,
        cbu: body?.cbu?.trim() || null,
      },
    });

    return NextResponse.json(created, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Error al crear proveedor." }, { status: 500 });
  }
}
