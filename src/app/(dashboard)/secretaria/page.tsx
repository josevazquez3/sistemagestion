import Link from "next/link";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { FileText, ScrollText, ClipboardList, CalendarDays, FileStack, ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

const enlaces = [
  {
    href: "/secretaria/modelos-notas",
    titulo: "Modelos de Notas",
    descripcion: "Plantillas y modelos de notas institucionales.",
    icon: FileText,
  },
  {
    href: "/secretaria/actas",
    titulo: "Actas",
    descripcion: "Actas de reuniones y documentación.",
    icon: ScrollText,
  },
  {
    href: "/secretaria/orden-del-dia",
    titulo: "Orden del día C.S.",
    descripcion: "Orden del día del Consejo Superior.",
    icon: ClipboardList,
  },
  {
    href: "/secretaria/agenda",
    titulo: "Agenda",
    descripcion: "Reuniones y compromisos.",
    icon: CalendarDays,
  },
  {
    href: "/legales/tsd",
    titulo: "TSD — Seguimiento de expedientes",
    descripcion: "Estados y movimientos de expedientes (Legales / Secretaría).",
    icon: FileStack,
  },
] as const;

export default async function SecretariaPage() {
  const session = await auth();
  const roles = (session?.user as { roles?: string[] })?.roles ?? [];
  const puedeAcceder =
    roles.includes("ADMIN") || roles.includes("SECRETARIA") || roles.includes("SUPER_ADMIN");

  if (!puedeAcceder) {
    redirect("/dashboard");
  }

  return (
    <div className="max-w-6xl mx-auto">
      <h1 className="text-2xl font-semibold text-gray-800">Secretaría</h1>
      <p className="text-gray-500 mt-1 mb-6">
        Elegí un módulo o abrilo desde el menú lateral desplegando{" "}
        <strong className="text-gray-700">Secretaría</strong>.
      </p>

      <ul className="grid gap-4 sm:grid-cols-2">
        {enlaces.map((item) => {
          const Icon = item.icon;
          return (
            <li key={item.href}>
              <Link href={item.href} className="block group">
                <Card className="h-full border-gray-200 transition-shadow hover:shadow-md hover:border-[#C8E6C9]">
                  <CardContent className="p-5 flex gap-4 items-start">
                    <div className="rounded-lg bg-[#E8F5E9] p-3 text-[#388E3C]">
                      <Icon className="h-6 w-6" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 font-semibold text-gray-800 group-hover:text-[#388E3C]">
                        {item.titulo}
                        <ChevronRight className="h-4 w-4 opacity-60 shrink-0" />
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">{item.descripcion}</p>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
