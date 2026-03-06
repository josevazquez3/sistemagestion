import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { AgendaContent } from "@/components/secretaria/agenda/AgendaContent";

export default async function AgendaPage() {
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
      <h1 className="text-2xl font-semibold text-gray-800">Agenda</h1>
      <p className="text-gray-500 mt-1">
        Gestión de reuniones institucionales.
      </p>
      <AgendaContent />
    </div>
  );
}
