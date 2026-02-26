import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  getHistorialVacaciones,
  getAniosConSolicitudes,
} from "@/app/actions/vacaciones";
import { HistorialSkeleton } from "@/components/vacaciones/historial/HistorialSkeleton";
import { HistorialContent } from "@/components/vacaciones/historial/HistorialContent";
import { SelectorEmpleadoAdmin } from "@/components/vacaciones/historial/SelectorEmpleadoAdmin";
import { Suspense } from "react";
import { FileText } from "lucide-react";

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function HistorialVacacionesPage({
  searchParams,
}: PageProps) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login?callbackUrl=/rrhh/vacaciones/historial");
  }

  const params = await searchParams;
  const anioParam = params.anio;
  const estadoParam = params.estado;
  const legajoIdParam = params.legajoId;

  const anio =
    typeof anioParam === "string" && anioParam
      ? parseInt(anioParam, 10)
      : undefined;
  const estado =
    typeof estadoParam === "string" &&
    ["PENDIENTE", "APROBADA", "BAJA", "TODOS"].includes(estadoParam)
      ? estadoParam
      : undefined;
  const legajoIdFromUrl =
    typeof legajoIdParam === "string" && legajoIdParam.trim()
      ? legajoIdParam.trim()
      : undefined;

  const roles = (session.user as { roles?: string[] }).roles ?? [];
  const esAdmin = roles.includes("ADMIN") || roles.includes("RRHH");

  let legajos: { id: string; apellidos: string; nombres: string }[] = [];
  if (esAdmin) {
    legajos = await prisma.legajo.findMany({
      where: { fechaBaja: null },
      select: { id: true, apellidos: true, nombres: true },
      orderBy: { apellidos: "asc" },
    });
  }

  const userLegajoId = (session.user as { legajoId?: string }).legajoId;
  const legajoId = legajoIdFromUrl ?? userLegajoId ?? null;

  if (!legajoId) {
    return (
      <div className="max-w-6xl space-y-6">
        <h1 className="text-2xl font-semibold text-gray-800 flex items-center gap-2">
          <FileText className="h-7 w-7 text-[#4CAF50]" />
          Historial de Vacaciones
        </h1>
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-amber-900">
          Tu usuario no está vinculado a un legajo. Contactá al administrador.
        </div>
      </div>
    );
  }

  const [historialRes, aniosRes] = await Promise.all([
    getHistorialVacaciones({
      legajoId,
      anio,
      estado: estado ?? "TODOS",
    }),
    getAniosConSolicitudes(legajoId),
  ]);

  if (!historialRes.success) {
    return (
      <div className="max-w-6xl space-y-6">
        <h1 className="text-2xl font-semibold text-gray-800">
          Historial de Vacaciones
        </h1>
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-800">
          {historialRes.error}
        </div>
      </div>
    );
  }

  const { solicitudes, totalesPorAnio, aniosDisponibles } = historialRes.data;
  const aniosDisponiblesData = aniosRes.success ? aniosRes.data : [];

  const legajo = await prisma.legajo.findUnique({
    where: { id: legajoId },
    select: { apellidos: true, nombres: true },
  });
  const nombreEmpleado = legajo
    ? `${legajo.apellidos}, ${legajo.nombres}`
    : "Empleado";

  return (
    <div className="max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-800 flex items-center gap-2">
          <FileText className="h-7 w-7 text-[#4CAF50]" />
          Historial de Vacaciones
        </h1>
        <p className="text-gray-500 mt-1">
          Consultá el historial de solicitudes y exportá a Excel o PDF
        </p>
      </div>

      {esAdmin && (
        <SelectorEmpleadoAdmin
          legajos={legajos}
          legajoActual={legajoId}
        />
      )}

      <Suspense fallback={<HistorialSkeleton />}>
        <HistorialContent
          solicitudes={solicitudes}
          totalesPorAnio={totalesPorAnio}
          aniosDisponibles={aniosDisponiblesData}
          nombreEmpleado={nombreEmpleado}
          legajoId={legajoId}
          anio={anio}
          estado={estado}
          esAdmin={esAdmin}
        />
      </Suspense>
    </div>
  );
}
