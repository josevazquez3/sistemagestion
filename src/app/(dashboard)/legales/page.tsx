import Link from "next/link";
import { FileText, ClipboardList, FileStack, ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { auth } from "@/lib/auth";

const enlaces = [
  {
    href: "/legales/modelos-oficios",
    titulo: "Modelos de Oficios",
    descripcion: "Plantillas y modelos de oficios.",
    icon: FileText,
  },
  {
    href: "/legales/historial-oficios",
    titulo: "Historial de Oficios",
    descripcion: "Oficios respondidos y seguimiento.",
    icon: ClipboardList,
  },
  {
    href: "/legales/historial-tsd",
    titulo: "Historial Exptes. TSD",
    descripcion: "Historial de expedientes TSD con documentos adjuntos.",
    icon: FileStack,
  },
  {
    href: "/legales/tsd",
    titulo: "TSD — Seguimiento de expedientes",
    descripcion: "Registro, estados y movimientos de expedientes.",
    icon: FileStack,
  },
] as const;

function usuarioPuedeVerEnlace(href: string, roles: string[]): boolean {
  const r = new Set(roles);
  const esLegalesCore =
    r.has("SUPER_ADMIN") || r.has("ADMIN") || r.has("LEGALES");
  const esTsd =
    esLegalesCore || r.has("SECRETARIA");
  if (href === "/legales/tsd") return esTsd;
  if (
    href === "/legales/historial-tsd" ||
    href === "/legales/historial-oficios" ||
    href === "/legales/modelos-oficios"
  ) {
    return esLegalesCore;
  }
  return true;
}

export default async function LegalesPage() {
  const session = await auth();
  const roles = (session?.user as { roles?: string[] })?.roles ?? [];
  const enlacesVisibles = enlaces.filter((e) => usuarioPuedeVerEnlace(e.href, roles));

  return (
    <div className="max-w-6xl mx-auto">
      <h1 className="text-2xl font-semibold text-gray-800">Legales</h1>
      <p className="text-gray-500 mt-1 mb-6">
        Accedé a cada submódulo o usá el menú lateral <strong className="text-gray-700">Legales</strong>.
      </p>

      <ul className="grid gap-4 sm:grid-cols-2">
        {enlacesVisibles.map((item) => {
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
