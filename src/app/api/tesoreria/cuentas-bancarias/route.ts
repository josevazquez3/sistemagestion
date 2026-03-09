import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

const ROLES = ["ADMIN", "TESORERO", "SUPER_ADMIN"] as const;

function canAccess(roles: string[]) {
  return ROLES.some((r) => roles.includes(r));
}

function parseId(id: string): number | null {
  const n = parseInt(id, 10);
  return isNaN(n) ? null : n;
}

/** GET - Listar con búsqueda y paginación */
export async function GET(req: NextRequest) {
  const session = await auth();
  const roles = (session?.user as { roles?: string[] })?.roles ?? [];
  if (!canAccess(roles)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim() ?? "";
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const perPage = Math.min(50, Math.max(1, parseInt(searchParams.get("perPage") ?? "20", 10)));

  const where: Prisma.CuentaBancariaWhereInput = {};
  if (q) {
    where.OR = [
      { codigo: { contains: q, mode: "insensitive" } },
      { nombre: { contains: q, mode: "insensitive" } },
    ];
  }

  const [data, total] = await Promise.all([
    prisma.cuentaBancaria.findMany({
      where,
      orderBy: [{ codigo: "asc" }],
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    prisma.cuentaBancaria.count({ where }),
  ]);

  return NextResponse.json({ data, total, page, perPage });
}

/** POST - Crear cuenta */
export async function POST(req: NextRequest) {
  const session = await auth();
  const roles = (session?.user as { roles?: string[] })?.roles ?? [];
  if (!canAccess(roles)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  let body: { codigo?: string; codOperativo?: string | null; nombre?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
  }

  const codigo = (body.codigo ?? "").trim();
  const codOperativo = (body.codOperativo ?? "").trim() || null;
  const nombre = (body.nombre ?? "").trim();
  if (!codigo || !nombre) {
    return NextResponse.json({ error: "Código y nombre son obligatorios" }, { status: 400 });
  }

  const existente = await prisma.cuentaBancaria.findUnique({ where: { codigo } });
  if (existente) {
    return NextResponse.json({ error: "Ya existe una cuenta con ese código" }, { status: 409 });
  }

  const cuenta = await prisma.cuentaBancaria.create({
    data: { codigo, codOperativo, nombre },
  });
  return NextResponse.json(cuenta, { status: 201 });
}
