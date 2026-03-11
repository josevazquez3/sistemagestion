import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { CobroCertificacionesContent } from "@/components/tesoreria/cobro-certificaciones/CobroCertificacionesContent";

export default async function CobroCertificacionesPage() {
  const session = await auth();
  const roles = (session?.user as { roles?: string[] })?.roles ?? [];
  const puedeAcceder =
    roles.includes("ADMIN") || roles.includes("TESORERO") || roles.includes("SUPER_ADMIN");

  if (!puedeAcceder) {
    redirect("/dashboard");
  }

  return (
    <div className="max-w-[1600px] mx-auto">
      <h1 className="text-2xl font-semibold text-gray-800">Cobro Certificaciones</h1>
      <p className="text-gray-500 mt-1">
        Gestión de cobros por certificaciones.
      </p>
      <CobroCertificacionesContent />
    </div>
  );
}
