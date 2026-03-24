"use client";

import { useEffect, useState } from "react";
import { signOut } from "next-auth/react";
import { User, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CampanaNotificaciones } from "@/components/notificaciones/CampanaNotificaciones";
import type { Session } from "next-auth";

export function Header({ user }: { user: Session["user"] }) {
  const [legajoFotoUrl, setLegajoFotoUrl] = useState<string | null>(null);
  const [fotoBroken, setFotoBroken] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch("/api/me");
        if (!r.ok || cancelled) return;
        const d = (await r.json()) as { legajoFotoUrl?: string | null };
        const u = d.legajoFotoUrl;
        if (cancelled) return;
        setLegajoFotoUrl(typeof u === "string" && u.trim() !== "" ? u.trim() : null);
      } catch {
        if (!cancelled) setLegajoFotoUrl(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setFotoBroken(false);
  }, [legajoFotoUrl]);

  const showFoto = legajoFotoUrl && !fotoBroken;

  return (
    <header className="h-16 border-b border-gray-200 bg-white px-6 flex items-center justify-between shadow-sm">
      <div className="flex-1" />
      <div className="flex items-center gap-4">
        {/* Campana de notificaciones - Paso 6 */}
        <CampanaNotificaciones />
        <div className="flex items-center gap-2 text-sm text-gray-600">
          {showFoto ? (
            <img
              src={legajoFotoUrl}
              alt=""
              className="h-8 w-8 shrink-0 rounded-full border border-gray-200 object-cover"
              onError={() => setFotoBroken(true)}
            />
          ) : (
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#C8E6C9]">
              <User className="h-4 w-4 text-[#388E3C]" />
            </div>
          )}
          <span className="font-medium">{user?.name ?? "Usuario"}</span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="text-gray-600 hover:text-red-600"
        >
          <LogOut className="h-4 w-4 mr-1" />
          Salir
        </Button>
      </div>
    </header>
  );
}
