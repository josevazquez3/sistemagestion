import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { ActasContent } from "@/components/secretaria/actas/ActasContent";

export default async function ActasPage() {
  const session = await auth();
  const roles = (session?.user as { roles?: string[] })?.roles ?? [];
  const puedeAcceder =
    roles.includes("ADMIN") || roles.includes("SECRETARIA");

  if (!puedeAcceder) {
    redirect("/dashboard");
  }

  return (
    <div className="max-w-6xl mx-auto">
      <h1 className="text-2xl font-semibold text-gray-800">Actas</h1>
      <p className="text-gray-500 mt-1">
        Gestión de actas institucionales.
      </p>
      <ActasContent />
    </div>
  );
}
