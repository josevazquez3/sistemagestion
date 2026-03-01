import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { ModelosNotasContent } from "./ModelosNotasContent";

export default async function ModelosNotasPage() {
  const session = await auth();
  const roles = (session?.user as { roles?: string[] })?.roles ?? [];
  const puedeAcceder = roles.includes("ADMIN") || roles.includes("SECRETARIA");

  if (!puedeAcceder) {
    redirect("/dashboard");
  }

  return (
    <div className="max-w-6xl mx-auto">
      <h1 className="text-2xl font-semibold text-gray-800">Modelos de Notas</h1>
      <p className="text-gray-500 mt-1">
        Gestioná tipos de nota y modelos de documentos .docx para Secretaría.
      </p>
      <ModelosNotasContent />
    </div>
  );
}
