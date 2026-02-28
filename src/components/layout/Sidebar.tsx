"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  FileText,
  Landmark,
  Scale,
  UserCog,
  Calendar,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Session } from "next-auth";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/rrhh/legajos", label: "Legajos", icon: Users, parent: "rrhh" },
  { href: "/rrhh/licencias", label: "Licencias", icon: FileText, parent: "rrhh" },
  { href: "/rrhh/vacaciones", label: "Vacaciones", icon: Calendar, parent: "rrhh" },
  { href: "/rrhh/vacaciones/historial", label: "Historial de Vacaciones", icon: FileText, parent: "rrhh" },
  { href: "/rrhh/vacaciones/admin", label: "Vacaciones (Admin)", icon: Calendar, parent: "rrhh", adminOnly: true },
  { href: "/tesoreria", label: "Tesorería", icon: Landmark },
  { href: "/legales", label: "Legales", icon: Scale },
  { href: "/secretaria", label: "Secretaría", icon: FileText },
  { href: "/usuarios", label: "Usuarios", icon: UserCog, adminOnly: true },
  { href: "/configuraciones", label: "Configuraciones", icon: Settings, configuracionesOnly: true },
];

export function Sidebar({ user }: { user: Session["user"] }) {
  const pathname = usePathname();
  const isAdmin = (user as { roles?: string[] })?.roles?.includes("ADMIN") ?? false;
  const isRrhh = (user as { roles?: string[] })?.roles?.includes("RRHH") ?? false;

  const items = navItems.filter((item) => {
    if ("configuracionesOnly" in item && item.configuracionesOnly && !isAdmin) return false;
    if (item.adminOnly && !isAdmin && !isRrhh) return false;
    return true;
  });

  return (
    <aside className="w-64 border-r border-gray-200 bg-white shadow-sm flex flex-col fixed h-full">
      <div className="p-6 border-b border-gray-100">
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="h-9 w-9 rounded-lg bg-[#4CAF50] flex items-center justify-center text-white font-bold text-sm">
            SG
          </div>
          <span className="font-semibold text-gray-800">
            {process.env.NEXT_PUBLIC_APP_NAME ?? "Sistema de Gestión"}
          </span>
        </Link>
      </div>
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive =
            pathname === item.href ||
            (item.parent && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-colors",
                isActive
                  ? "bg-[#E8F5E9] text-[#388E3C]"
                  : "text-gray-600 hover:bg-[#E8F5E9] hover:text-gray-800"
              )}
            >
              <Icon className="h-5 w-5 shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
