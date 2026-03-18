import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { ModelosOficiosContent } from "@/components/legales/modelos-oficios/ModelosOficiosContent";

export default async function ModelosOficiosPage() {
  const session = await auth();
  const roles = (session?.user as { roles?: string[] })?.roles ?? [];
  const puedeAcceder = roles.includes("ADMIN") || roles.includes("LEGALES");

  if (!puedeAcceder) {
    redirect("/dashboard");
  }

  return (
    <div className="max-w-6xl mx-auto">
      <h1 className="text-2xl font-semibold text-gray-800">Modelos de Oficios</h1>
      <p className="text-gray-500 mt-1">
        Gestioná tipos de oficio y modelos Word (.doc y .docx) para Legales.
      </p>
      <ModelosOficiosContent />
    </div>
  );
}
