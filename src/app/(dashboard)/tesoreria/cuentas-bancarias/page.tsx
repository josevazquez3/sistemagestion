import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { CuentasBancariasContent } from "@/components/tesoreria/cuentas-bancarias/CuentasBancariasContent";

export default async function CuentasBancariasPage() {
  const session = await auth();
  const roles = (session?.user as { roles?: string[] })?.roles ?? [];
  const puedeAcceder =
    roles.includes("ADMIN") || roles.includes("TESORERO") || roles.includes("SUPER_ADMIN");

  if (!puedeAcceder) {
    redirect("/dashboard");
  }

  return (
    <div className="max-w-6xl mx-auto">
      <h1 className="text-2xl font-semibold text-gray-800">Cuentas Bancarias</h1>
      <p className="text-gray-500 mt-1">
        Gestión de cuentas para clasificación de movimientos.
      </p>
      <CuentasBancariasContent />
    </div>
  );
}
