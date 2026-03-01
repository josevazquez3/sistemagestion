"use client";

import { useState, useEffect } from "react";
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
  ChevronDown,
  ScrollText,
  BookOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Session } from "next-auth";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/rrhh", label: "Recursos Humanos", icon: Users, expandable: true },
  { href: "/rrhh/legajos", label: "Legajos", icon: Users, parent: "rrhh" },
  { href: "/rrhh/licencias", label: "Licencias", icon: FileText, parent: "rrhh" },
  { href: "/rrhh/vacaciones", label: "Vacaciones", icon: Calendar, parent: "rrhh" },
  { href: "/rrhh/vacaciones/historial", label: "Historial de Vacaciones", icon: FileText, parent: "rrhh" },
  { href: "/rrhh/vacaciones/admin", label: "Vacaciones (Admin)", icon: Calendar, parent: "rrhh", adminOnly: true },
  { href: "/tesoreria", label: "Tesorería", icon: Landmark },
  { href: "/legislacion", label: "Legislación", icon: BookOpen, expandable: true },
  { href: "/legislacion", label: "Legislación", icon: BookOpen, parent: "legislacion" },
  { href: "/legislacion/resoluciones", label: "Resoluciones C.S.", icon: FileText, parent: "legislacion" },
  { href: "/legales", label: "Legales", icon: Scale },
  { href: "/secretaria", label: "Secretaría", icon: FileText, secretariaModule: true, expandable: true },
  { href: "/secretaria/modelos-notas", label: "Modelos de Notas", icon: FileText, parent: "secretaria", secretariaModule: true },
  { href: "/secretaria/actas", label: "Actas", icon: ScrollText, parent: "secretaria", secretariaModule: true },
  { href: "/usuarios", label: "Usuarios", icon: UserCog, adminOnly: true },
  { href: "/configuraciones", label: "Configuraciones", icon: Settings, configuracionesOnly: true },
];

const rrhhSubItems = [
  { href: "/rrhh/legajos", label: "Legajos", icon: Users },
  { href: "/rrhh/licencias", label: "Licencias", icon: FileText },
  { href: "/rrhh/vacaciones", label: "Vacaciones", icon: Calendar },
  { href: "/rrhh/vacaciones/historial", label: "Historial de Vacaciones", icon: FileText },
  { href: "/rrhh/vacaciones/admin", label: "Vacaciones (Admin)", icon: Calendar, adminOnly: true },
];

const secretariaSubItems = [
  { href: "/secretaria/modelos-notas", label: "Modelos de Notas", icon: FileText },
  { href: "/secretaria/actas", label: "Actas", icon: ScrollText },
];

const legislacionSubItems = [
  { href: "/legislacion", label: "Legislación", icon: BookOpen },
  { href: "/legislacion/resoluciones", label: "Resoluciones C.S.", icon: FileText },
];

export function Sidebar({ user }: { user: Session["user"] }) {
  const pathname = usePathname();
  const isAdmin = (user as { roles?: string[] })?.roles?.includes("ADMIN") ?? false;
  const isRrhh = (user as { roles?: string[] })?.roles?.includes("RRHH") ?? false;
  const isSecretaria = (user as { roles?: string[] })?.roles?.includes("SECRETARIA") ?? false;

  const [rrhhAbierto, setRrhhAbierto] = useState(() =>
    pathname.startsWith("/rrhh")
  );

  const [secretariaAbierta, setSecretariaAbierta] = useState(() =>
    pathname.startsWith("/secretaria")
  );

  const [legislacionAbierta, setLegislacionAbierta] = useState(() =>
    pathname.startsWith("/legislacion")
  );

  useEffect(() => {
    if (pathname.startsWith("/rrhh")) {
      setRrhhAbierto(true);
    }
  }, [pathname]);

  useEffect(() => {
    if (pathname.startsWith("/secretaria")) {
      setSecretariaAbierta(true);
    }
  }, [pathname]);

  useEffect(() => {
    if (pathname.startsWith("/legislacion")) {
      setLegislacionAbierta(true);
    }
  }, [pathname]);

  const items = navItems.filter((item) => {
    if ("configuracionesOnly" in item && item.configuracionesOnly && !isAdmin) return false;
    if (item.adminOnly && !isAdmin && !isRrhh) return false;
    if ("secretariaModule" in item && item.secretariaModule && !isAdmin && !isSecretaria) return false;
    return true;
  });

  const showSecretaria = isAdmin || isSecretaria;

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
          if ("expandable" in item && item.expandable && item.href === "/rrhh") {
            const ParentIcon = item.icon;
            const isParentActive = pathname.startsWith("/rrhh");
            return (
              <div key={item.href} className="space-y-1">
                <button
                  type="button"
                  onClick={() => setRrhhAbierto((v) => !v)}
                  className={cn(
                    "flex w-full items-center justify-between gap-2 rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200",
                    isParentActive
                      ? "bg-[#E8F5E9] text-[#388E3C]"
                      : "text-gray-600 hover:bg-[#E8F5E9] hover:text-gray-800"
                  )}
                >
                  <span className="flex items-center gap-3">
                    <ParentIcon className="h-5 w-5 shrink-0" />
                    {item.label}
                  </span>
                  <ChevronDown
                    className={cn("h-4 w-4 shrink-0 transition-transform duration-200", rrhhAbierto && "rotate-180")}
                  />
                </button>
                {rrhhAbierto && (
                  <div className="pl-6 space-y-1 overflow-hidden transition-all duration-200">
                    {rrhhSubItems
                      .filter((sub) => !("adminOnly" in sub && sub.adminOnly) || isAdmin || isRrhh)
                      .map((sub) => {
                        const SubIcon = sub.icon;
                        const isActive = pathname === sub.href || pathname.startsWith(sub.href + "/");
                        return (
                          <Link
                            key={sub.href}
                            href={sub.href}
                            className={cn(
                              "flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-colors",
                              isActive
                                ? "bg-[#E8F5E9] text-[#388E3C]"
                                : "text-gray-600 hover:bg-[#E8F5E9] hover:text-gray-800"
                            )}
                          >
                            <SubIcon className="h-5 w-5 shrink-0" />
                            {sub.label}
                          </Link>
                        );
                      })}
                  </div>
                )}
              </div>
            );
          }
          if ("expandable" in item && item.expandable && item.href === "/legislacion") {
            const ParentIcon = item.icon;
            const isParentActive = pathname.startsWith("/legislacion");
            return (
              <div key={item.href} className="space-y-1">
                <button
                  type="button"
                  onClick={() => setLegislacionAbierta((v) => !v)}
                  className={cn(
                    "flex w-full items-center justify-between gap-2 rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200",
                    isParentActive
                      ? "bg-[#E8F5E9] text-[#388E3C]"
                      : "text-gray-600 hover:bg-[#E8F5E9] hover:text-gray-800"
                  )}
                >
                  <span className="flex items-center gap-3">
                    <ParentIcon className="h-5 w-5 shrink-0" />
                    {item.label}
                  </span>
                  <ChevronDown
                    className={cn("h-4 w-4 shrink-0 transition-transform duration-200", legislacionAbierta && "rotate-180")}
                  />
                </button>
                {legislacionAbierta && (
                  <div className="pl-6 space-y-1 overflow-hidden transition-all duration-200">
                    {legislacionSubItems.map((sub) => {
                      const SubIcon = sub.icon;
                      const isActive = pathname === sub.href || pathname.startsWith(sub.href + "/");
                      return (
                        <Link
                          key={sub.href}
                          href={sub.href}
                          className={cn(
                            "flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-colors",
                            isActive
                              ? "bg-[#E8F5E9] text-[#388E3C]"
                              : "text-gray-600 hover:bg-[#E8F5E9] hover:text-gray-800"
                          )}
                        >
                          <SubIcon className="h-5 w-5 shrink-0" />
                          {sub.label}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          }
          if ("expandable" in item && item.expandable && item.href === "/secretaria") {
            if (!showSecretaria) return null;
            const ParentIcon = item.icon;
            const isParentActive = pathname.startsWith("/secretaria");
            return (
              <div key={item.href} className="space-y-1">
                <button
                  type="button"
                  onClick={() => setSecretariaAbierta((v) => !v)}
                  className={cn(
                    "flex w-full items-center justify-between gap-2 rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200",
                    isParentActive
                      ? "bg-[#E8F5E9] text-[#388E3C]"
                      : "text-gray-600 hover:bg-[#E8F5E9] hover:text-gray-800"
                  )}
                >
                  <span className="flex items-center gap-3">
                    <ParentIcon className="h-5 w-5 shrink-0" />
                    {item.label}
                  </span>
                  <ChevronDown
                    className={cn("h-4 w-4 shrink-0 transition-transform duration-200", secretariaAbierta && "rotate-180")}
                  />
                </button>
                {secretariaAbierta && (
                  <div className="pl-6 space-y-1 overflow-hidden transition-all duration-200">
                    {secretariaSubItems.map((sub) => {
                      const SubIcon = sub.icon;
                      const isActive = pathname === sub.href || pathname.startsWith(sub.href + "/");
                      return (
                        <Link
                          key={sub.href}
                          href={sub.href}
                          className={cn(
                            "flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-colors",
                            isActive
                              ? "bg-[#E8F5E9] text-[#388E3C]"
                              : "text-gray-600 hover:bg-[#E8F5E9] hover:text-gray-800"
                          )}
                        >
                          <SubIcon className="h-5 w-5 shrink-0" />
                          {sub.label}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          }
          if ("parent" in item && item.parent === "rrhh") return null;
          if ("parent" in item && item.parent === "legislacion") return null;
          if ("parent" in item && item.parent === "secretaria") return null;
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
