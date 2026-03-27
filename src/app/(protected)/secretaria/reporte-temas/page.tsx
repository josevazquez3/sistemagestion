import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { formatearFechaUTC } from "@/lib/utils/fecha";
import { ReporteTemasTable, type ReporteTemaRow } from "@/components/secretaria/temas/ReporteTemasTable";

function pickLatestIso(usos: { createdAt: Date; fechaOD: Date | null; guiaMesa: Date | null }[]) {
  if (!usos || usos.length === 0) return { fechaOD: null as Date | null, guiaMesa: null as Date | null };
  const u = [...usos].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0]!;
  return { fechaOD: u.fechaOD ?? null, guiaMesa: u.guiaMesa ?? null };
}

export default async function ReporteTemasPage() {
  const session = await auth();
  const roles = (session?.user as { roles?: string[] })?.roles ?? [];
  const puedeAcceder = roles.includes("ADMIN") || roles.includes("SECRETARIA") || roles.includes("SUPER_ADMIN");
  if (!puedeAcceder) redirect("/dashboard");

  const temas = await prisma.tema.findMany({
    include: { usos: true },
    orderBy: { numero: "asc" },
  });

  const rows: ReporteTemaRow[] = temas.map((t) => {
    const cantOD = t.usos.filter((u) => u.fechaOD != null).length;
    const cantGuia = t.usos.filter((u) => u.guiaMesa != null).length;
    const latest = pickLatestIso(
      t.usos.map((u) => ({ createdAt: u.createdAt, fechaOD: u.fechaOD, guiaMesa: u.guiaMesa }))
    );
    return {
      temaId: t.id,
      temaNumero: t.numero,
      tema: t.tema,
      fechaOD: latest.fechaOD ? formatearFechaUTC(latest.fechaOD) : null,
      guiaMesa: latest.guiaMesa ? formatearFechaUTC(latest.guiaMesa) : null,
      cantOD,
      cantGuia,
      eliminado: t.deletedAt != null,
    };
  });

  return (
    <div className="max-w-[1600px] mx-auto">
      <ReporteTemasTable rows={rows} />
    </div>
  );
}

