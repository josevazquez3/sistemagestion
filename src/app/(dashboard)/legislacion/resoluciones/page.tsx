import { auth } from "@/lib/auth";
import { LegislacionContent } from "@/components/legislacion/LegislacionContent";

export default async function ResolucionesPage() {
  const session = await auth();
  const roles = (session?.user as { roles?: string[] })?.roles ?? [];
  const canEdit = roles.includes("ADMIN") || roles.includes("SECRETARIA");

  return (
    <div className="max-w-6xl mx-auto">
      <h1 className="text-2xl font-semibold text-gray-800">Resoluciones C.S.</h1>
      <p className="text-gray-500 mt-1">
        Resoluciones del Consejo Superior.
      </p>
      <LegislacionContent seccion="RESOLUCIONES_CS" canEdit={canEdit} />
    </div>
  );
}
