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
  ClipboardList,
  CalendarDays,
  Wallet,
  Award,
  Building2,
  CheckSquare,
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
  { href: "/rrhh/novedades-liquidadores", label: "Novedades Liquidadores", icon: ClipboardList, parent: "rrhh" },
  { href: "/tesoreria", label: "Tesorería", icon: Landmark, expandable: true, tesoreriaModule: true },
  { href: "/tesoreria/cuentas-bancarias", label: "Cuentas Bancarias", icon: Landmark, parent: "tesoreria", tesoreriaModule: true },
  { href: "/tesoreria/extracto-banco", label: "Extracto Banco", icon: Wallet, parent: "tesoreria", tesoreriaModule: true },
  { href: "/tesoreria/conciliacion-banco", label: "Conciliación Banco", icon: CheckSquare, parent: "tesoreria", tesoreriaModule: true },
  { href: "/tesoreria/proveedores", label: "Proveedores", icon: Building2, parent: "tesoreria", tesoreriaModule: true },
  { href: "/tesoreria/proveedores/facturas", label: "Cargar Facturas", icon: FileText, parent: "tesoreria", tesoreriaModule: true },
  { href: "/tesoreria/mayores-cuentas", label: "Mayores - Cuentas", icon: BookOpen, parent: "tesoreria", tesoreriaModule: true },
  { href: "/tesoreria/informe", label: "Informe Tesorería", icon: FileText, parent: "tesoreria", tesoreriaModule: true },
  { href: "/legislacion", label: "Legislación", icon: BookOpen },
  { href: "/legales", label: "Legales", icon: Scale, expandable: true, legalesModule: true },
  { href: "/legales/modelos-oficios", label: "Modelos de Oficios", icon: FileText, parent: "legales", legalesModule: true },
  { href: "/legales/historial-oficios", label: "Historial de Oficios", icon: ClipboardList, parent: "legales", legalesModule: true },
  { href: "/secretaria", label: "Secretaría", icon: FileText, secretariaModule: true, expandable: true },
  { href: "/secretaria/modelos-notas", label: "Modelos de Notas", icon: FileText, parent: "secretaria", secretariaModule: true },
  { href: "/secretaria/actas", label: "Actas", icon: ScrollText, parent: "secretaria", secretariaModule: true },
  { href: "/secretaria/orden-del-dia", label: "Orden del día C.S.", icon: ClipboardList, parent: "secretaria", secretariaModule: true },
  { href: "/secretaria/agenda", label: "Agenda", icon: CalendarDays, parent: "secretaria", secretariaModule: true },
  { href: "/usuarios", label: "Usuarios", icon: UserCog, adminOnly: true },
  { href: "/configuraciones", label: "Configuraciones", icon: Settings, configuracionesOnly: true },
];

const rrhhSubItems = [
  { href: "/rrhh/legajos", label: "Legajos", icon: Users },
  { href: "/rrhh/licencias", label: "Licencias", icon: FileText },
  { href: "/rrhh/vacaciones", label: "Vacaciones", icon: Calendar },
  { href: "/rrhh/vacaciones/historial", label: "Historial de Vacaciones", icon: FileText },
  { href: "/rrhh/vacaciones/admin", label: "Vacaciones (Admin)", icon: Calendar, adminOnly: true },
  { href: "/rrhh/novedades-liquidadores", label: "Novedades Liquidadores", icon: ClipboardList },
];

const secretariaSubItems = [
  { href: "/secretaria/modelos-notas", label: "Modelos de Notas", icon: FileText },
  { href: "/secretaria/actas", label: "Actas", icon: ScrollText },
  { href: "/secretaria/orden-del-dia", label: "Orden del día C.S.", icon: ClipboardList },
  { href: "/secretaria/agenda", label: "Agenda", icon: CalendarDays },
];

const legalesSubItems = [
  { href: "/legales/modelos-oficios", label: "Modelos de Oficios", icon: FileText },
  { href: "/legales/historial-oficios", label: "Historial de Oficios", icon: ClipboardList },
];

const tesoreriaSubItems = [
  { href: "/tesoreria/cuentas-bancarias", label: "Cuentas Bancarias", icon: Landmark },
  { href: "/tesoreria/extracto-banco", label: "Extracto Banco", icon: Wallet },
  { href: "/tesoreria/conciliacion-banco", label: "Conciliación Banco", icon: CheckSquare },
  { href: "/tesoreria/proveedores", label: "Proveedores", icon: Building2 },
  { href: "/tesoreria/proveedores/facturas", label: "Cargar Facturas", icon: FileText },
  { href: "/tesoreria/fondo-fijo", label: "Fondo Fijo", icon: Wallet },
  { href: "/tesoreria/cobro-certificaciones", label: "Cobro Certificaciones", icon: Award },
  { href: "/tesoreria/ingresos-distritos", label: "Ingresos Distritos", icon: Building2 },
  { href: "/tesoreria/mayores-cuentas", label: "Mayores - Cuentas", icon: BookOpen },
  { href: "/tesoreria/informe", label: "Informe Tesorería", icon: FileText },
];

export function Sidebar({ user }: { user: Session["user"] }) {
  const pathname = usePathname();
  const isAdmin = (user as { roles?: string[] })?.roles?.includes("ADMIN") ?? false;
  const isRrhh = (user as { roles?: string[] })?.roles?.includes("RRHH") ?? false;
  const isSecretaria = (user as { roles?: string[] })?.roles?.includes("SECRETARIA") ?? false;
  const isSuperAdmin = (user as { roles?: string[] })?.roles?.includes("SUPER_ADMIN") ?? false;
  const isLegales = (user as { roles?: string[] })?.roles?.includes("LEGALES") ?? false;
  const isTesorero = (user as { roles?: string[] })?.roles?.includes("TESORERO") ?? false;

  const [rrhhAbierto, setRrhhAbierto] = useState(() =>
    pathname.startsWith("/rrhh")
  );

  const [secretariaAbierta, setSecretariaAbierta] = useState(() =>
    pathname.startsWith("/secretaria")
  );

  const [legalesAbierta, setLegalesAbierta] = useState(() =>
    pathname.startsWith("/legales")
  );

  const [tesoreriaAbierta, setTesoreriaAbierta] = useState(() =>
    pathname.startsWith("/tesoreria")
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
    if (pathname.startsWith("/legales")) {
      setLegalesAbierta(true);
    }
  }, [pathname]);

  useEffect(() => {
    if (pathname.startsWith("/tesoreria")) {
      setTesoreriaAbierta(true);
    }
  }, [pathname]);

  const items = navItems.filter((item) => {
    if (
      "configuracionesOnly" in item &&
      item.configuracionesOnly &&
      !isAdmin &&
      !isSuperAdmin
    )
      return false;
    if (item.adminOnly && !isAdmin && !isRrhh) return false;
    if ("secretariaModule" in item && item.secretariaModule && !isAdmin && !isSecretaria && !isSuperAdmin) return false;
    if ("legalesModule" in item && item.legalesModule && !isAdmin && !isLegales) return false;
    if ("tesoreriaModule" in item && item.tesoreriaModule && !isAdmin && !isTesorero && !isSuperAdmin) return false;
    return true;
  });

  const showSecretaria = isAdmin || isSecretaria || isSuperAdmin;
  const showLegales = isAdmin || isLegales;
  const showTesoreria = isAdmin || isTesorero || isSuperAdmin;

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
          if ("expandable" in item && item.expandable && item.href === "/legales") {
            if (!showLegales) return null;
            const ParentIcon = item.icon;
            const isParentActive = pathname.startsWith("/legales");
            return (
              <div key={item.href} className="space-y-1">
                <button
                  type="button"
                  onClick={() => setLegalesAbierta((v) => !v)}
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
                    className={cn("h-4 w-4 shrink-0 transition-transform duration-200", legalesAbierta && "rotate-180")}
                  />
                </button>
                {legalesAbierta && (
                  <div className="pl-6 space-y-1 overflow-hidden transition-all duration-200">
                    {legalesSubItems.map((sub) => {
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
          if ("expandable" in item && item.expandable && item.href === "/tesoreria") {
            if (!showTesoreria) return null;
            const ParentIcon = item.icon;
            const isParentActive = pathname.startsWith("/tesoreria");
            return (
              <div key={item.href} className="space-y-1">
                <button
                  type="button"
                  onClick={() => setTesoreriaAbierta((v) => !v)}
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
                    className={cn("h-4 w-4 shrink-0 transition-transform duration-200", tesoreriaAbierta && "rotate-180")}
                  />
                </button>
                {tesoreriaAbierta && (
                  <div className="pl-6 space-y-1 overflow-hidden transition-all duration-200">
                    {tesoreriaSubItems.map((sub) => {
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
          if ("parent" in item && item.parent === "legales") return null;
          if ("parent" in item && item.parent === "secretaria") return null;
          if ("parent" in item && item.parent === "tesoreria") return null;
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
