"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatearFechaUTC } from "@/lib/utils/fecha";

type InformeListItem = {
  id: number;
  fechaDesde: string;
  fechaHasta: string;
  createdAt: string;
};

export function InformeListadoContent() {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<InformeListItem[]>([]);
  const [mensaje, setMensaje] = useState<{ tipo: "ok" | "error"; text: string } | null>(
    null
  );
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/tesoreria/informe");
      const data = await res.json();
      if (!res.ok) {
        setItems([]);
        setMensaje({ tipo: "error", text: data?.error || "Error al cargar informes." });
        return;
      }
      setItems(Array.isArray(data) ? (data as InformeListItem[]) : []);
    } catch {
      setItems([]);
      setMensaje({ tipo: "error", text: "Error de conexión al cargar informes." });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!mensaje) return;
    const t = setTimeout(() => setMensaje(null), 4000);
    return () => clearTimeout(t);
  }, [mensaje]);

  const eliminar = async (id: number) => {
    if (!confirm("¿Eliminar este informe? Esta acción no se puede deshacer.")) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/tesoreria/informe/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setMensaje({ tipo: "error", text: data?.error || "No se pudo eliminar el informe." });
        return;
      }
      setItems((prev) => prev.filter((x) => x.id !== id));
      setMensaje({ tipo: "ok", text: "Informe eliminado." });
    } catch {
      setMensaje({ tipo: "error", text: "Error de conexión al eliminar." });
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-4 mt-6">
      {mensaje && (
        <div
          className={`rounded-lg border px-4 py-3 text-sm ${
            mensaje.tipo === "ok"
              ? "border-green-200 bg-green-50 text-green-800"
              : "border-red-200 bg-red-50 text-red-800"
          }`}
        >
          {mensaje.text}
        </div>
      )}

      <Card>
        <CardContent className="pt-6">
          {loading ? (
            <p className="text-muted-foreground py-8 text-center">Cargando…</p>
          ) : items.length === 0 ? (
            <p className="text-muted-foreground py-8 text-center">
              No hay informes creados aún.
            </p>
          ) : (
            <div className="border rounded-lg overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-gray-600">
                    <th className="p-3 pl-4">Período</th>
                    <th className="p-3">Fecha de creación</th>
                    <th className="p-3 text-right pr-4">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it) => (
                    <tr key={it.id} className="border-b hover:bg-muted/40">
                      <td className="p-3 pl-4 whitespace-nowrap">
                        {formatearFechaUTC(new Date(it.fechaDesde))} —{" "}
                        {formatearFechaUTC(new Date(it.fechaHasta))}
                      </td>
                      <td className="p-3 whitespace-nowrap">
                        {formatearFechaUTC(new Date(it.createdAt))}
                      </td>
                      <td className="p-3 pr-4">
                        <div className="flex justify-end gap-2">
                          <Link href={`/tesoreria/informe/${it.id}`}>
                            <Button type="button" size="sm" variant="outline">
                              Ver
                            </Button>
                          </Link>
                          <Button
                            type="button"
                            size="sm"
                            variant="destructive"
                            disabled={deletingId === it.id}
                            onClick={() => void eliminar(it.id)}
                          >
                            {deletingId === it.id ? "…" : "Eliminar"}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
