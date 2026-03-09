import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { ExtractoBancoContent } from "@/components/tesoreria/extracto-banco/ExtractoBancoContent";

export default async function ExtractoBancoPage() {
  const session = await auth();
  const roles = (session?.user as { roles?: string[] })?.roles ?? [];
  const puedeAcceder =
    roles.includes("ADMIN") || roles.includes("TESORERO") || roles.includes("SUPER_ADMIN");

  if (!puedeAcceder) {
    redirect("/dashboard");
  }

  return (
    <div className="max-w-[1600px] mx-auto">
      <h1 className="text-2xl font-semibold text-gray-800">Extracto Banco</h1>
      <p className="text-gray-500 mt-1">
        Gestión e importación de movimientos bancarios.
      </p>
      <ExtractoBancoContent />
    </div>
  );
}
