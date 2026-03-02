import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { HistorialOficiosContent } from "@/components/legales/historial-oficios/HistorialOficiosContent";

export default async function HistorialOficiosPage() {
  const session = await auth();
  const roles = (session?.user as { roles?: string[] })?.roles ?? [];
  const puedeAcceder = roles.includes("ADMIN") || roles.includes("LEGALES");

  if (!puedeAcceder) {
    redirect("/dashboard");
  }

  return (
    <div className="max-w-6xl mx-auto">
      <h1 className="text-2xl font-semibold text-gray-800">Historial de Oficios Respondidos</h1>
      <p className="text-gray-500 mt-1">
        Gestión del historial de oficios respondidos.
      </p>
      <HistorialOficiosContent />
    </div>
  );
}
