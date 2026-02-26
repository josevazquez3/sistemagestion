"use client";

import { Bell } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  getCantidadNoLeidas,
  getNotificaciones,
  marcarNotificacionLeida,
  marcarTodasLeidas,
  type NotificacionItem,
} from "@/app/actions/notificaciones";
import { TipoNotificacion } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const POLL_INTERVAL_MS = 30_000;

function tiempoRelativo(fecha: Date): string {
  const ahora = new Date();
  const d = typeof fecha === "object" && "getTime" in fecha ? fecha : new Date(fecha);
  const segundos = Math.floor((ahora.getTime() - d.getTime()) / 1000);

  if (segundos < 60) return "hace un momento";
  if (segundos < 120) return "hace 1 minuto";
  if (segundos < 3600) return `hace ${Math.floor(segundos / 60)} minutos`;
  if (segundos < 7200) return "hace 1 hora";
  if (segundos < 86400) return `hace ${Math.floor(segundos / 3600)} horas`;
  if (segundos < 172800) return "hace 1 día";
  if (segundos < 604800) return `hace ${Math.floor(segundos / 86400)} días`;
  return "hace más de una semana";
}

function iconoPorTipo(tipo: TipoNotificacion): { emoji: string; clase: string } {
  switch (tipo) {
    case "VACACIONES_APROBADA":
      return { emoji: "✅", clase: "text-green-600" };
    case "VACACIONES_BAJA":
      return { emoji: "❌", clase: "text-red-600" };
    case "VACACIONES_BAJA_APROBADA":
      return { emoji: "🔄", clase: "text-amber-600" };
    default:
      return { emoji: "📌", clase: "text-gray-600" };
  }
}

export function CampanaNotificaciones() {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [cantidadNoLeidas, setCantidadNoLeidas] = useState(0);
  const [notificaciones, setNotificaciones] = useState<NotificacionItem[]>([]);
  const [cargandoLista, setCargandoLista] = useState(false);
  const contenedorRef = useRef<HTMLDivElement>(null);

  const actualizarCantidad = useCallback(async () => {
    const res = await getCantidadNoLeidas();
    if (res.success && typeof res.data === "number") {
      setCantidadNoLeidas(res.data);
    }
  }, []);

  useEffect(() => {
    actualizarCantidad();
    const id = setInterval(actualizarCantidad, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [actualizarCantidad]);

  const abrirDropdown = useCallback(async () => {
    if (!abierto) {
      setCargandoLista(true);
      const res = await getNotificaciones();
      setCargandoLista(false);
      if (res.success && res.data) {
        setNotificaciones(res.data);
      }
    }
    setAbierto((prev) => !prev);
  }, [abierto]);

  useEffect(() => {
    function manejarClickAfuera(e: MouseEvent) {
      if (
        contenedorRef.current &&
        !contenedorRef.current.contains(e.target as Node)
      ) {
        setAbierto(false);
      }
    }
    document.addEventListener("click", manejarClickAfuera);
    return () => document.removeEventListener("click", manejarClickAfuera);
  }, []);

  const marcarLeida = useCallback(
    async (id: number, solicitudId: number | null) => {
      const res = await marcarNotificacionLeida(id);
      if (res.success) {
        setNotificaciones((prev) =>
          prev.map((n) => (n.id === id ? { ...n, leida: true } : n))
        );
        setCantidadNoLeidas((c) => Math.max(0, c - 1));
        setAbierto(false);
        if (solicitudId != null) {
          router.push("/rrhh/vacaciones");
        }
      }
    },
    [router]
  );

  const marcarTodas = useCallback(async () => {
    const res = await marcarTodasLeidas();
    if (res.success) {
      setNotificaciones((prev) => prev.map((n) => ({ ...n, leida: true })));
      setCantidadNoLeidas(0);
    }
  }, []);

  return (
    <div className="relative" ref={contenedorRef}>
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={abrirDropdown}
        className="relative text-gray-600 hover:text-gray-900"
        aria-label="Notificaciones"
      >
        <Bell className="h-5 w-5" />
        {cantidadNoLeidas > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-medium text-white">
            {cantidadNoLeidas > 99 ? "99+" : cantidadNoLeidas}
          </span>
        )}
      </Button>

      {abierto && (
        <div
          className="absolute right-0 top-full z-50 mt-2 w-80 rounded-lg border border-gray-200 bg-white shadow-lg"
          role="dialog"
          aria-label="Lista de notificaciones"
        >
          <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
            <span className="font-medium text-gray-900">Notificaciones</span>
            {notificaciones.some((n) => !n.leida) && (
              <button
                type="button"
                onClick={marcarTodas}
                className="text-xs text-blue-600 hover:underline"
              >
                Marcar todas leídas
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {cargandoLista ? (
              <div className="flex items-center justify-center py-8 text-sm text-gray-500">
                Cargando...
              </div>
            ) : notificaciones.length === 0 ? (
              <div className="py-8 text-center text-sm text-gray-500">
                No hay notificaciones
              </div>
            ) : (
              <ul className="divide-y divide-gray-100">
                {notificaciones.map((n) => {
                  const { emoji, clase } = iconoPorTipo(n.tipo);
                  return (
                    <li key={n.id}>
                      <button
                        type="button"
                        onClick={() => marcarLeida(n.id, n.solicitudId)}
                        className={cn(
                          "flex w-full gap-3 px-4 py-3 text-left transition-colors hover:bg-gray-50",
                          !n.leida && "bg-blue-50/50"
                        )}
                      >
                        <span className={cn("text-lg shrink-0", clase)}>
                          {emoji}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p
                            className={cn(
                              "text-sm",
                              !n.leida ? "font-medium text-gray-900" : "text-gray-700"
                            )}
                          >
                            {n.titulo}
                          </p>
                          <p className="mt-0.5 truncate text-xs text-gray-500">
                            {n.mensaje}
                          </p>
                          <p className="mt-1 text-[10px] text-gray-400">
                            {tiempoRelativo(n.createdAt)}
                          </p>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
