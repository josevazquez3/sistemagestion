"use client";

import { useCallback, useEffect, useState } from "react";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { getExpedientes } from "@/lib/actions/tsd.actions";
import type { TsdExpedienteConMovimientos } from "@/lib/actions/tsd.actions";
import { TsdTabla, buildVistaFilas } from "@/components/tsd/TsdTabla";
import { ModalIngresarExpte } from "@/components/tsd/ModalIngresarExpte";
import type { ModalIngresarEditContext } from "@/components/tsd/ModalIngresarExpte";
import { ModalSeguimiento } from "@/components/tsd/ModalSeguimiento";
import type { ExpedienteSeguimientoRef } from "@/components/tsd/ModalSeguimiento";
import { ModalExportarSeguimiento } from "@/components/tsd/ModalExportarSeguimiento";
import { formatTsdFecha, hoyParaNombreArchivo, tsdEstadoLabel } from "@/lib/tsd/display";

type Props = {
  initialExpedientes: TsdExpedienteConMovimientos[];
};

export function TsdPage({ initialExpedientes }: Props) {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [expedientes, setExpedientes] = useState<TsdExpedienteConMovimientos[]>(initialExpedientes);
  const [mensaje, setMensaje] = useState<{ tipo: "ok" | "error"; text: string } | null>(null);

  const [modalIngresarOpen, setModalIngresarOpen] = useState(false);
  const [modalIngresarMode, setModalIngresarMode] = useState<"create" | "edit">("create");
  const [editContext, setEditContext] = useState<ModalIngresarEditContext | null>(null);

  const [modalSeguimientoOpen, setModalSeguimientoOpen] = useState(false);
  const [expedienteSeguimiento, setExpedienteSeguimiento] = useState<ExpedienteSeguimientoRef | null>(
    null
  );

  const [modalExportarOpen, setModalExportarOpen] = useState(false);

  const showMsg = useCallback((tipo: "ok" | "error", text: string) => {
    setMensaje({ tipo, text });
  }, []);

  useEffect(() => {
    if (!mensaje) return;
    const t = setTimeout(() => setMensaje(null), 4500);
    return () => clearTimeout(t);
  }, [mensaje]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const recargar = useCallback(async () => {
    try {
      const data = await getExpedientes(debouncedSearch || undefined);
      setExpedientes(data);
    } catch (e) {
      showMsg("error", e instanceof Error ? e.message : "Error al cargar expedientes.");
    }
  }, [debouncedSearch, showMsg]);

  useEffect(() => {
    void recargar();
  }, [debouncedSearch, recargar]);

  const abrirIngresar = () => {
    setModalIngresarMode("create");
    setEditContext(null);
    setModalIngresarOpen(true);
  };

  const abrirEditar = (ctx: ModalIngresarEditContext) => {
    setModalIngresarMode("edit");
    setEditContext(ctx);
    setModalIngresarOpen(true);
  };

  const abrirSeguimiento = (ex: ExpedienteSeguimientoRef) => {
    setExpedienteSeguimiento(ex);
    setModalSeguimientoOpen(true);
  };

  const exportarVista = () => {
    const filas = buildVistaFilas(expedientes);
    if (filas.length === 0) {
      showMsg("error", "No hay filas para exportar.");
      return;
    }
    const rows: (string | number)[][] = [
      ["Fecha", "Nº Expte.", "Carátula", "Distrito", "Estado", "Observación"],
    ];
    for (const f of filas) {
      rows.push([
        formatTsdFecha(new Date(f.movimiento.fecha)),
        f.expediente.nroExpte,
        f.expediente.caratula,
        f.expediente.distrito,
        tsdEstadoLabel(f.movimiento.estado),
        f.movimiento.observacion ?? "",
      ]);
    }
    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "TSD");
    XLSX.writeFile(wb, `TSD_Expedientes_${hoyParaNombreArchivo()}.xlsx`);
    showMsg("ok", "Archivo descargado.");
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
        <CardContent className="pt-6 space-y-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div className="w-full max-w-md">
              <label htmlFor="tsd-search" className="text-xs text-muted-foreground">
                Buscar por Nº Expediente
              </label>
              <Input
                id="tsd-search"
                className="mt-1"
                placeholder="Buscar por Nº Expediente..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" className="bg-[#388E3C] hover:bg-[#2E7D32] text-white" onClick={abrirIngresar}>
                Ingresar Expte.
              </Button>
              <Button type="button" variant="outline" onClick={() => setModalExportarOpen(true)}>
                Exportar Seguimiento
              </Button>
              <Button type="button" variant="secondary" onClick={exportarVista}>
                Exportar Vista
              </Button>
            </div>
          </div>

          <TsdTabla
            expedientes={expedientes}
            onEditar={abrirEditar}
            onSeguimiento={abrirSeguimiento}
            onChanged={() => void recargar()}
            onError={(msg) => showMsg("error", msg)}
            onOk={(msg) => showMsg("ok", msg)}
          />
        </CardContent>
      </Card>

      <ModalIngresarExpte
        open={modalIngresarOpen}
        onOpenChange={setModalIngresarOpen}
        mode={modalIngresarMode}
        editContext={editContext}
        onGuardado={() => void recargar()}
        onError={(msg) => showMsg("error", msg)}
      />

      <ModalSeguimiento
        open={modalSeguimientoOpen}
        onOpenChange={setModalSeguimientoOpen}
        expediente={expedienteSeguimiento}
        onGuardado={() => void recargar()}
        onError={(msg) => showMsg("error", msg)}
      />

      <ModalExportarSeguimiento
        open={modalExportarOpen}
        onOpenChange={setModalExportarOpen}
        onError={(msg) => showMsg("error", msg)}
      />
    </div>
  );
}
