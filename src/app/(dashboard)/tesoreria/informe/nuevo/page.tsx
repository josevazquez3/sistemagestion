"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { InputFecha } from "@/components/ui/InputFecha";
import { parsearFechaSegura } from "@/lib/utils/fecha";

export default function NuevoInformeTesoreriaPage() {
  const router = useRouter();
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");
  const [loading, setLoading] = useState(false);
  const [mensaje, setMensaje] = useState<{ tipo: "ok" | "error"; text: string } | null>(
    null
  );

  const crearInforme = async () => {
    const d0 = parsearFechaSegura(fechaDesde.trim());
    const d1 = parsearFechaSegura(fechaHasta.trim());
    if (!d0 || !d1) {
      setMensaje({ tipo: "error", text: "Revisá las fechas (DD/MM/YYYY)." });
      return;
    }
    if (d0.getTime() > d1.getTime()) {
      setMensaje({
        tipo: "error",
        text: "La fecha Desde no puede ser posterior a la fecha Hasta.",
      });
      return;
    }

    setLoading(true);
    setMensaje(null);
    try {
      const res = await fetch("/api/tesoreria/informe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fechaDesde: d0.toISOString(),
          fechaHasta: d1.toISOString(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMensaje({ tipo: "error", text: data?.error || "No se pudo crear el informe." });
        return;
      }
      const id = Number(data?.id);
      if (!id || Number.isNaN(id)) {
        setMensaje({ tipo: "error", text: "Informe creado sin ID válido." });
        return;
      }
      router.push(`/tesoreria/informe/${id}`);
    } catch {
      setMensaje({ tipo: "error", text: "Error de conexión al crear informe." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto mt-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-800">Nuevo Informe de Tesorería</h1>
        <p className="text-gray-500 mt-1">
          Definí el período base para crear el informe.
        </p>
      </div>

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
        <CardHeader>
          <span className="font-semibold text-lg">Período</span>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="text-sm text-muted-foreground">Fecha Desde (DD/MM/YYYY)</Label>
            <InputFecha
              value={fechaDesde}
              onChange={setFechaDesde}
              className="mt-1 flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm"
            />
          </div>
          <div>
            <Label className="text-sm text-muted-foreground">Fecha Hasta (DD/MM/YYYY)</Label>
            <InputFecha
              value={fechaHasta}
              onChange={setFechaHasta}
              className="mt-1 flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm"
            />
          </div>

          <div className="pt-2 flex flex-wrap gap-2 justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push("/tesoreria/informe")}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              className="bg-green-600 hover:bg-green-700 text-white"
              onClick={() => void crearInforme()}
              disabled={loading}
            >
              {loading ? "Creando…" : "Crear Informe"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
