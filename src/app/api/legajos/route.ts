import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function canManageLegajos(roles: string[]) {
  return roles.includes("ADMIN") || roles.includes("RRHH");
}

/** GET - Listar legajos con búsqueda, filtro y paginación */
export async function GET(req: NextRequest) {
  const session = await auth();
  const roles = (session?.user as { roles?: string[] })?.roles ?? [];
  if (!canManageLegajos(roles) && !roles.includes("SECRETARIA") && !roles.includes("EMPLEADO")) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim() ?? "";
  const estado = searchParams.get("estado") ?? "activo"; // activo | baja
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
  const perPage = 10;

  const where: { fechaBaja?: null | { not: null }; OR?: object[] } =
    estado === "baja" ? { fechaBaja: { not: null } } : { fechaBaja: null };

  if (q) {
    const numLegajo = parseInt(q, 10);
    const or: object[] = [
      { nombres: { contains: q, mode: "insensitive" as const } },
      { apellidos: { contains: q, mode: "insensitive" as const } },
      { dni: { contains: q } },
    ];
    if (!isNaN(numLegajo)) or.push({ numeroLegajo: numLegajo });
    (where as { OR?: object[] }).OR = or;
  }

  const [legajos, total] = await Promise.all([
    prisma.legajo.findMany({
      where,
      include: { contactos: { include: { telefonos: true } } },
      orderBy: { numeroLegajo: "asc" },
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    prisma.legajo.count({ where }),
  ]);

  return NextResponse.json({
    data: legajos,
    pagination: { page, perPage, total, totalPages: Math.ceil(total / perPage) },
  });
}

/** POST - Crear legajo (solo RRHH y ADMIN) */
export async function POST(req: Request) {
  const session = await auth();
  const roles = (session?.user as { roles?: string[] })?.roles ?? [];
  if (!canManageLegajos(roles)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const {
      numeroLegajo,
      nombres,
      apellidos,
      dni,
      cuil,
      fotoUrl,
      calle,
      numero,
      casa,
      departamento,
      piso,
      localidad,
      codigoPostal,
      fechaAlta,
      celular,
      contactos = [],
    } = body;

    if (!numeroLegajo || !nombres || !apellidos || !dni || !calle || numero == null || !localidad || !codigoPostal || !fechaAlta) {
      return NextResponse.json({ error: "Faltan campos obligatorios" }, { status: 400 });
    }

    const existNum = await prisma.legajo.findFirst({ where: { numeroLegajo: parseInt(numeroLegajo) } });
    if (existNum) return NextResponse.json({ error: "El número de legajo ya existe" }, { status: 400 });

    const existDni = await prisma.legajo.findFirst({ where: { dni: String(dni) } });
    if (existDni) return NextResponse.json({ error: "El DNI ya está registrado" }, { status: 400 });

    const legajo = await prisma.legajo.create({
      data: {
        numeroLegajo: parseInt(numeroLegajo),
        nombres,
        apellidos,
        dni: String(dni),
        cuil: cuil || null,
        fotoUrl: fotoUrl || null,
        calle,
        numero: parseInt(numero),
        casa: casa || null,
        departamento: departamento || null,
        piso: piso || null,
        localidad,
        codigoPostal: String(codigoPostal),
        fechaAlta: new Date(fechaAlta),
        celular: celular || null,
        contactos: {
          create: contactos.map((c: { nombres: string; apellidos: string; parentesco: string; calle?: string; numero?: string; casa?: string; departamento?: string; piso?: string; telefonos?: string[] }) => ({
            nombres: c.nombres,
            apellidos: c.apellidos,
            parentesco: c.parentesco,
            calle: c.calle || null,
            numero: c.numero || null,
            casa: c.casa || null,
            departamento: c.departamento || null,
            piso: c.piso || null,
            telefonos: {
              create: (c.telefonos ?? []).map((num: string) => ({ numero: num })),
            },
          })),
        },
      },
      include: { contactos: { include: { telefonos: true } } },
    });

    return NextResponse.json(legajo);
  } catch (e) {
    console.error("Error creando legajo:", e);
    return NextResponse.json({ error: "Error al crear legajo" }, { status: 500 });
  }
}
