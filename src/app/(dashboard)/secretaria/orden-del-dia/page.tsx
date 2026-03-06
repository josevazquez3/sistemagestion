import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { OrdenDelDiaContent } from "@/components/secretaria/orden-del-dia/OrdenDelDiaContent";

export default async function OrdenDelDiaPage() {
  const session = await auth();
  const roles = (session?.user as { roles?: string[] })?.roles ?? [];
  const puedeAcceder =
    roles.includes("ADMIN") ||
    roles.includes("SECRETARIA") ||
    roles.includes("SUPER_ADMIN");

  if (!puedeAcceder) {
    redirect("/dashboard");
  }

  return (
    <div className="max-w-6xl mx-auto">
      <h1 className="text-2xl font-semibold text-gray-800">Orden del día y Guía de Mesa C.S.</h1>
      <p className="text-gray-500 mt-1">
        Gestión de órdenes del día y guías de mesa del Consejo Superior.
      </p>
      <OrdenDelDiaContent canEdit={puedeAcceder} />
    </div>
  );
}
