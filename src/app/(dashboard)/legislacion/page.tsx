import { auth } from "@/lib/auth";
import { LegislacionContent } from "@/components/legislacion/LegislacionContent";

export default async function LegislacionPage() {
  const session = await auth();
  const roles = (session?.user as { roles?: string[] })?.roles ?? [];
  const canEdit = roles.includes("ADMIN") || roles.includes("SECRETARIA");

  return (
    <div className="max-w-6xl mx-auto">
      <h1 className="text-2xl font-semibold text-gray-800">Legislación</h1>
      <p className="text-gray-500 mt-1">
        Normativa y documentación legal institucional.
      </p>
      <LegislacionContent seccion="LEGISLACION" canEdit={canEdit} />
    </div>
  );
}
