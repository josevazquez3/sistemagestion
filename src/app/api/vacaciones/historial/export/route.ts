import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { getHistorialVacaciones } from "@/app/actions/vacaciones";
import { exportarHistorialExcel, nombreArchivoHistorial } from "@/lib/exportarHistorialExcel";
import {
  exportarHistorialPDF,
  nombreArchivoHistorialPDF,
} from "@/lib/exportarHistorialPDF";

const ROLES_ADMIN = ["ADMIN", "RRHH"] as const;

function esAdmin(roles: string[]): boolean {
  return ROLES_ADMIN.some((r) => roles.includes(r));
}

const querySchema = z.object({
  formato: z.enum(["excel", "pdf"]),
  legajoId: z.string().min(1).optional(),
  anio: z.coerce.number().int().min(2000).max(2100).optional(),
  estado: z.enum(["PENDIENTE", "APROBADA", "BAJA", "TODOS"]).optional(),
});

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { error: "Debés iniciar sesión para descargar el historial." },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const legajoIdRaw = searchParams.get("legajoId");
    const params = {
      formato: searchParams.get("formato") ?? undefined,
      legajoId: legajoIdRaw && legajoIdRaw.trim() ? legajoIdRaw.trim() : undefined,
      anio: searchParams.get("anio") ?? undefined,
      estado: searchParams.get("estado") ?? undefined,
    };

    const parsed = querySchema.safeParse(params);
    if (!parsed.success) {
      const firstError = parsed.error.issues[0];
      const mensaje =
        firstError?.message ?? "Parámetros inválidos. Revisá formato, legajoId, anio y estado.";
      return NextResponse.json({ error: mensaje }, { status: 400 });
    }

    const { formato, legajoId: legajoIdParam, anio, estado } = parsed.data;
    const userLegajoId = (session.user as { legajoId?: string }).legajoId;
    const roles = (session.user as { roles?: string[] }).roles ?? [];
    const esAdminRol = esAdmin(roles);

    let legajoFinal: string;
    if (legajoIdParam) {
      if (!esAdminRol && legajoIdParam !== userLegajoId) {
        return NextResponse.json(
          { error: "No tenés permisos para exportar el historial de otro empleado." },
          { status: 403 }
        );
      }
      legajoFinal = legajoIdParam;
    } else {
      if (!userLegajoId) {
        return NextResponse.json(
          {
            error:
              "Tu usuario no está vinculado a un legajo. Contactá al administrador.",
          },
          { status: 404 }
        );
      }
      legajoFinal = userLegajoId;
    }

    const legajo = await prisma.legajo.findUnique({
      where: { id: legajoFinal },
      select: { apellidos: true, nombres: true },
    });

    if (!legajo) {
      return NextResponse.json(
        { error: "Legajo no encontrado." },
        { status: 404 }
      );
    }

    const nombreEmpleado = `${legajo.apellidos}, ${legajo.nombres}`;

    const historialRes = await getHistorialVacaciones({
      legajoId: legajoFinal,
      anio,
      estado: estado ?? "TODOS",
    });

    if (!historialRes.success) {
      return NextResponse.json(
        { error: historialRes.error ?? "Error al obtener el historial." },
        { status: 400 }
      );
    }

    const { solicitudes, totalesPorAnio } = historialRes.data;

    if (formato === "excel") {
      const buffer = exportarHistorialExcel(
        solicitudes,
        totalesPorAnio,
        nombreEmpleado,
        anio
      );
      const filename = nombreArchivoHistorial(nombreEmpleado, anio, "xlsx");
      return new NextResponse(buffer, {
        headers: {
          "Content-Type":
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="${filename}"`,
        },
      });
    }

    const buffer = exportarHistorialPDF(
      solicitudes,
      totalesPorAnio,
      nombreEmpleado,
      anio
    );
    const filename = nombreArchivoHistorialPDF(nombreEmpleado, anio);
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Error al generar el archivo. Intentá nuevamente." },
      { status: 500 }
    );
  }
}
