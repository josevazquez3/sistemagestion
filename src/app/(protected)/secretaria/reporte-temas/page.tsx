import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getReporteTemasRows } from "@/lib/secretaria/reporteTemasData";
import { ReporteTemasTable } from "@/components/secretaria/temas/ReporteTemasTable";

export default async function ReporteTemasPage() {
  const session = await auth();
  const roles = (session?.user as { roles?: string[] })?.roles ?? [];
  const puedeAcceder = roles.includes("ADMIN") || roles.includes("SECRETARIA") || roles.includes("SUPER_ADMIN");
  if (!puedeAcceder) redirect("/dashboard");

  const rows = await getReporteTemasRows();

  return (
    <div className="max-w-[1600px] mx-auto">
      <ReporteTemasTable rows={rows} />
    </div>
  );
}

