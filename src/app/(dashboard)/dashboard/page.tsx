import { auth } from "@/lib/auth";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { EstadoVacaciones } from "@prisma/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, CalendarDays, Scale } from "lucide-react";
import { DashboardLicenciasWidget } from "@/components/licencias/DashboardLicenciasWidget";
import { NovedadesLiquidadoresCard } from "@/components/dashboard/NovedadesLiquidadoresCard";
import { SecretariaDashboardCard } from "@/components/dashboard/SecretariaDashboardCard";
import { TesoreriaDashboardCard } from "@/components/dashboard/TesoreriaDashboardCard";
import { ensureTsdTables } from "@/lib/legales/ensureTsdTables";

export const dynamic = "force-dynamic";

const ROLES_ADMIN = ["ADMIN", "RRHH"] as const;
const ROLES_TESORERIA_RESUMEN = ["ADMIN", "TESORERO", "SUPER_ADMIN"] as const;
const ROLES_TSD = ["ADMIN", "LEGALES", "SECRETARIA", "SUPER_ADMIN"] as const;

export default async function DashboardPage() {
  const session = await auth();

  const totalLegajos = await prisma.legajo.count({
    where: { fechaBaja: null },
  });

  const roles = (session?.user as { roles?: string[] })?.roles ?? [];
  const esAdmin = ROLES_ADMIN.some((r) => roles.includes(r));

  const [solicitudesPendientes, totalPendientes] = esAdmin
    ? await Promise.all([
        prisma.solicitudVacaciones.findMany({
          where: { estado: EstadoVacaciones.PENDIENTE },
          include: {
            legajo: { select: { nombres: true, apellidos: true } },
          },
          orderBy: { createdAt: "asc" },
          take: 5,
        }),
        prisma.solicitudVacaciones.count({
          where: { estado: EstadoVacaciones.PENDIENTE },
        }),
      ])
    : [[], 0];

  const verResumenTesoreria = ROLES_TESORERIA_RESUMEN.some((r) => roles.includes(r));
  const verTsd = ROLES_TSD.some((r) => roles.includes(r));

  let tsdPendientesMuestra: { nroExpte: string }[] = [];
  let tsdPendientesCount = 0;
  if (verTsd) {
    try {
      await ensureTsdTables();
      [tsdPendientesMuestra, tsdPendientesCount] = await Promise.all([
        prisma.tsdExpediente.findMany({
          where: { finalizado: false },
          select: { nroExpte: true },
          orderBy: { nroExpte: "asc" },
          take: 8,
        }),
        prisma.tsdExpediente.count({
          where: { finalizado: false },
        }),
      ]);
    } catch {
      tsdPendientesMuestra = [];
      tsdPendientesCount = 0;
    }
  }

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h1 className="text-2xl font-semibold text-gray-800">
          Bienvenido, {session?.user?.name?.split(" ")[0] ?? "Usuario"}
        </h1>
        <p className="text-gray-500 mt-1">
          Sistema de Gestión Institucional
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card className="rounded-xl border shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Recursos Humanos
            </CardTitle>
            <Users className="h-4 w-4 text-[#4CAF50]" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-gray-800">{totalLegajos}</p>
            <p className="text-sm text-gray-600">Legajos activos</p>
            <CardDescription>Gestión de empleados y legajos</CardDescription>
          </CardContent>
        </Card>
        {/* Tarjeta Licencias - empleados con licencia activa */}
        {esAdmin && <DashboardLicenciasWidget />}
        {/* Tarjeta Novedades Liquidadores */}
        {esAdmin && <NovedadesLiquidadoresCard />}
        {/* Tarjeta Vacaciones */}
        <Link href={totalPendientes > 0 ? "/rrhh/vacaciones/admin" : "/rrhh/vacaciones"}>
          <Card
            className={
              totalPendientes > 0 && esAdmin
                ? "rounded-xl border-2 border-amber-400 bg-amber-50 shadow-sm hover:shadow-md transition-shadow"
                : "rounded-xl border shadow-sm hover:shadow-md transition-shadow"
            }
          >
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                Recursos Humanos
              </CardTitle>
              <div className="flex items-center gap-2">
                {totalPendientes > 0 && esAdmin && (
                  <span className="bg-amber-100 text-amber-700 text-xs font-medium px-2 py-0.5 rounded-full">
                    {totalPendientes} pendientes
                  </span>
                )}
                <CalendarDays className="h-4 w-4 text-[#4CAF50] shrink-0" />
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-gray-800">Vacaciones</p>
              <CardDescription>Gestión de licencias y vacaciones</CardDescription>
              {solicitudesPendientes.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {solicitudesPendientes.map((s) => (
                    <li
                      key={s.id}
                      className="text-xs text-amber-800 flex items-center gap-1"
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0" />
                      {s.legajo.apellidos}, {s.legajo.nombres}
                    </li>
                  ))}
                  {totalPendientes > 5 && (
                    <li className="text-xs text-amber-600 font-medium">
                      +{totalPendientes - 5} más...
                    </li>
                  )}
                </ul>
              )}
            </CardContent>
          </Card>
        </Link>
        {verTsd && (
          <Link href="/legales/tsd">
            <Card
              className={
                tsdPendientesCount > 0
                  ? "rounded-xl border-2 border-amber-400 bg-amber-50 shadow-sm hover:shadow-md transition-shadow"
                  : "rounded-xl border shadow-sm hover:shadow-md transition-shadow"
              }
            >
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">TSD</CardTitle>
                <div className="flex items-center gap-2">
                  {tsdPendientesCount > 0 && (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                      {tsdPendientesCount} pendiente{tsdPendientesCount === 1 ? "" : "s"}
                    </span>
                  )}
                  <Scale className="h-4 w-4 shrink-0 text-[#4CAF50]" />
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-gray-800">{tsdPendientesCount}</p>
                <p className="text-sm text-gray-600">Expedientes no finalizados</p>
                <CardDescription className="mt-1">
                  Seguimiento de expedientes (Legales)
                </CardDescription>
                {tsdPendientesCount > 0 && tsdPendientesMuestra.length > 0 && (
                  <p className="mt-3 text-xs font-medium leading-relaxed text-amber-900">
                    {tsdPendientesMuestra.map((e) => e.nroExpte).join(" - ")}
                    {tsdPendientesCount > tsdPendientesMuestra.length ? (
                      <span className="text-amber-700">
                        {" "}
                        — +{tsdPendientesCount - tsdPendientesMuestra.length} más…
                      </span>
                    ) : null}
                  </p>
                )}
              </CardContent>
            </Card>
          </Link>
        )}
        <SecretariaDashboardCard />
        <TesoreriaDashboardCard showBalances={verResumenTesoreria} />
      </div>
    </div>
  );
}
