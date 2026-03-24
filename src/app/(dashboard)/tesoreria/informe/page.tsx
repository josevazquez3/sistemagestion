import Link from "next/link";
import { Plus } from "lucide-react";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { InformeListadoContent } from "@/components/tesoreria/informe/InformeListadoContent";

export default async function InformeTesoreriaPage() {
  const session = await auth();
  const roles = (session?.user as { roles?: string[] })?.roles ?? [];
  const puedeAcceder =
    roles.includes("ADMIN") || roles.includes("TESORERO") || roles.includes("SUPER_ADMIN");

  if (!puedeAcceder) {
    redirect("/dashboard");
  }

  return (
    <div className="max-w-[1600px] mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-gray-800">Informe Tesorería</h1>
          <p className="text-gray-500 mt-1">
            Listado de informes por período y acceso a edición completa.
          </p>
        </div>
        <Link href="/tesoreria/informe/nuevo">
          <Button type="button" className="bg-green-600 hover:bg-green-700 text-white">
            <Plus className="w-4 h-4 mr-2" />
            Nuevo Informe
          </Button>
        </Link>
      </div>

      <InformeListadoContent />
    </div>
  );
}
