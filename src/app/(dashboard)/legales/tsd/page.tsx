import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { TsdPage } from "@/components/tsd/TsdPage";
import { getExpedientes, type TsdExpedienteConMovimientos } from "@/lib/actions/tsd.actions";

export default async function TsdLegalesPage() {
  const session = await auth();
  const roles = (session?.user as { roles?: string[] })?.roles ?? [];
  const puedeAcceder =
    roles.includes("ADMIN") ||
    roles.includes("LEGALES") ||
    roles.includes("SECRETARIA") ||
    roles.includes("SUPER_ADMIN");

  if (!puedeAcceder) {
    redirect("/dashboard");
  }

  let initialExpedientes: TsdExpedienteConMovimientos[] = [];
  try {
    initialExpedientes = await getExpedientes();
  } catch {
    initialExpedientes = [];
  }

  return (
    <div className="max-w-[1400px] mx-auto">
      <h1 className="text-2xl font-semibold text-gray-800">TSD — Seguimiento de Expedientes</h1>
      <p className="text-gray-500 mt-1">
        Registro y seguimiento de expedientes con movimientos y estados.
      </p>
      <TsdPage initialExpedientes={initialExpedientes} />
    </div>
  );
}
