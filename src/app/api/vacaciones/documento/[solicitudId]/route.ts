import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generarDocumentoVacaciones } from "@/lib/generarDocumentoVacaciones";

const ROLES_ADMIN = ["ADMIN", "RRHH"] as const;

/**
 * GET /api/vacaciones/documento/[solicitudId]
 * Descarga el documento DOCX de la solicitud de vacaciones.
 * Verifica que el usuario tenga acceso (propietario o ADMIN/RRHH).
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ solicitudId: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Debés iniciar sesión." }, { status: 401 });
  }

  const { solicitudId } = await params;
  const id = parseInt(solicitudId, 10);
  if (isNaN(id) || id < 1) {
    return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });
  }

  const solicitud = await prisma.solicitudVacaciones.findUnique({
    where: { id },
    include: { legajo: true },
  });

  if (!solicitud) {
    return NextResponse.json({ error: "Solicitud no encontrada." }, { status: 404 });
  }

  const userLegajoId = (session.user as { legajoId?: string }).legajoId;
  const roles = (session.user as { roles?: string[] }).roles ?? [];
  const esAdmin = ROLES_ADMIN.some((r) => roles.includes(r));

  if (!esAdmin && solicitud.legajoId !== userLegajoId) {
    return NextResponse.json(
      { error: "No tenés permisos para descargar esta solicitud." },
      { status: 403 }
    );
  }

  const buffer = await generarDocumentoVacaciones(id);
  if (!buffer) {
    return NextResponse.json(
      { error: "No se pudo generar el documento." },
      { status: 500 }
    );
  }

  const apellido = solicitud.legajo.apellidos.trim().replace(/\s+/g, "_");
  const anio = solicitud.fechaDesde.getFullYear();
  const filename = `vacaciones_${apellido}_${anio}.docx`;

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
