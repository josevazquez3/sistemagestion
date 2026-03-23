import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { ProveedoresContent } from "@/components/tesoreria/proveedores/ProveedoresContent";

export default async function ProveedoresPage() {
  const session = await auth();
  const roles = (session?.user as { roles?: string[] })?.roles ?? [];
  const puedeAcceder =
    roles.includes("ADMIN") || roles.includes("TESORERO") || roles.includes("SUPER_ADMIN");

  if (!puedeAcceder) {
    redirect("/dashboard");
  }

  return (
    <div className="max-w-[1600px] mx-auto">
      <h1 className="text-2xl font-semibold text-gray-800">Proveedores</h1>
      <p className="text-gray-500 mt-1">Gestión de proveedores</p>
      <ProveedoresContent />
    </div>
  );
}
