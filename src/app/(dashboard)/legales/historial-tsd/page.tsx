import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getHistorialTsd } from "@/lib/actions/legal-historial-tsd.actions";
import { HistorialTsdPage } from "@/components/legales/historial-tsd/HistorialTsdPage";
import type { HistorialTsdRow } from "@/components/legales/historial-tsd/types";

export default async function HistorialTsdLegalesPage() {
  const session = await auth();
  const roles = (session?.user as { roles?: string[] })?.roles ?? [];
  const puedeAcceder =
    roles.includes("SUPER_ADMIN") ||
    roles.includes("ADMIN") ||
    roles.includes("LEGALES");

  if (!puedeAcceder) {
    redirect("/dashboard");
  }

  const rows = await getHistorialTsd();
  const initialData: HistorialTsdRow[] = rows.map((r) => ({
    id: r.id,
    titulo: r.titulo,
    fechaOficio: r.fechaOficio.toISOString(),
    archivoNombre: r.archivoNombre,
    archivoUrl: r.archivoUrl,
    archivoKey: r.archivoKey,
    fechaCarga: r.fechaCarga.toISOString(),
    actualizadoEn: r.actualizadoEn.toISOString(),
  }));

  return (
    <div className="max-w-6xl mx-auto">
      <h1 className="text-2xl font-semibold text-gray-800">Historial Exptes. TSD</h1>
      <p className="text-gray-500 mt-1">
        Gestión del historial de expedientes TSD.
      </p>
      <HistorialTsdPage initialData={initialData} />
    </div>
  );
}
