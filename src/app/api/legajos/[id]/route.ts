import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { registrarAuditoria } from "@/lib/auditoria";
import { canManageLegajos } from "@/lib/auth.utils";
import { eliminarArchivo, esBlobUrl } from "@/lib/blob";

/** GET - Obtener legajo por ID */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const roles = (session?.user as { roles?: string[] })?.roles ?? [];
  if (!canManageLegajos(roles) && !roles.includes("SECRETARIA") && !roles.includes("EMPLEADO")) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { id } = await params;
  const legajo = await prisma.legajo.findUnique({
    where: { id },
    include: { contactos: { include: { telefonos: true } } },
  });

  if (!legajo) return NextResponse.json({ error: "Legajo no encontrado" }, { status: 404 });
  return NextResponse.json(legajo);
}

/** PATCH - Actualizar legajo (solo RRHH y ADMIN, solo si no está de baja) */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const roles = (session?.user as { roles?: string[] })?.roles ?? [];
  if (!canManageLegajos(roles)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { id } = await params;
  const legajo = await prisma.legajo.findUnique({ where: { id } });
  if (!legajo) return NextResponse.json({ error: "Legajo no encontrado" }, { status: 404 });
  if (legajo.fechaBaja) return NextResponse.json({ error: "El legajo está dado de baja" }, { status: 400 });

  try {
    const body = await req.json();

    /** Convierte valor de input date (YYYY-MM-DD o "") a Date a mediodía UTC para evitar desfase de un día en Argentina. */
    const toDateOrNull = (val: unknown): Date | null => {
      if (val == null || val === "") return null;
      const s = String(val).trim();
      if (!s) return null;
      if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return new Date(s + "T12:00:00.000Z");
      const d = new Date(s);
      return Number.isNaN(d.getTime()) ? null : d;
    };

    const update: Record<string, unknown> = {};
    const fields = [
      "numeroLegajo", "nombres", "apellidos", "dni", "cuil", "fotoUrl",
      "calle", "numero", "casa", "departamento", "piso",
      "localidad", "codigoPostal", "fechaAlta", "fechaNacimiento", "celular",
    ];
    const dateFields = ["fechaAlta", "fechaNacimiento"];
    for (const f of fields) {
      if (body[f] !== undefined) {
        if (f === "numeroLegajo" || f === "numero") (update as Record<string, number>)[f] = parseInt(body[f]);
        else if (dateFields.includes(f)) (update as Record<string, Date | null>)[f] = toDateOrNull(body[f]);
        else (update as Record<string, string | null>)[f] = body[f] ?? null;
      }
    }

    if (body.numeroLegajo !== undefined) {
      const exist = await prisma.legajo.findFirst({
        where: { numeroLegajo: parseInt(body.numeroLegajo), id: { not: id } },
      });
      if (exist) return NextResponse.json({ error: "El número de legajo ya existe" }, { status: 400 });
    }
    if (body.dni !== undefined) {
      const exist = await prisma.legajo.findFirst({
        where: { dni: String(body.dni), id: { not: id } },
      });
      if (exist) return NextResponse.json({ error: "El DNI ya está registrado" }, { status: 400 });
    }

    // Si se actualiza la foto y la anterior era de Blob, eliminarla
    if (body.fotoUrl !== undefined && body.fotoUrl !== legajo.fotoUrl && legajo.fotoUrl && esBlobUrl(legajo.fotoUrl)) {
      await eliminarArchivo(legajo.fotoUrl);
    }

    const contactos = body.contactos;
    if (Array.isArray(contactos)) {
      await prisma.telefonoContacto.deleteMany({
        where: { contacto: { legajoId: id } },
      });
      await prisma.contactoAdicional.deleteMany({ where: { legajoId: id } });
      if (contactos.length > 0) {
        for (const c of contactos) {
          const cont = await prisma.contactoAdicional.create({
            data: {
              legajoId: id,
              nombres: c.nombres,
              apellidos: c.apellidos,
              parentesco: c.parentesco,
              calle: c.calle || null,
              numero: c.numero || null,
              casa: c.casa || null,
              departamento: c.departamento || null,
              piso: c.piso || null,
              telefonos: { create: (c.telefonos ?? []).map((n: string) => ({ numero: n })) },
            },
          });
          if (cont) {} // avoid unused
        }
      }
    }

    const updated = await prisma.legajo.update({
      where: { id },
      data: update,
      include: { contactos: { include: { telefonos: true } } },
    });

    const user = session?.user as { id?: string; name?: string; email?: string };
    try {
      await registrarAuditoria({
        userId: user?.id ?? "",
        userNombre: user?.name ?? "",
        userEmail: user?.email ?? "",
        accion: "Editó un legajo",
        modulo: "Legajos",
        detalle: `Legajo N°${legajo.numeroLegajo} - ${legajo.apellidos} ${legajo.nombres}`,
        ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? undefined,
      });
    } catch {}

    return NextResponse.json(updated);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[PATCH /api/legajos/[id]] Error:", e);
    return NextResponse.json(
      { error: "Error al actualizar", detalle: msg },
      { status: 500 }
    );
  }
}
