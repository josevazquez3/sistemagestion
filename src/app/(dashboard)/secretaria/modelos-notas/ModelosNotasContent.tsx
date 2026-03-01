"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload, FolderUp } from "lucide-react";
import { TiposNotaPanel } from "@/components/secretaria/modelos-notas/TiposNotaPanel";
import { ModalCargaMasiva } from "@/components/secretaria/modelos-notas/ModalCargaMasiva";
import { ModelosNotaTabla } from "@/components/secretaria/modelos-notas/ModelosNotaTabla";
import { BuscadorModelos } from "@/components/secretaria/modelos-notas/BuscadorModelos";
import { ModalSubirModelo } from "@/components/secretaria/modelos-notas/ModalSubirModelo";
import { ModalEditarModelo } from "@/components/secretaria/modelos-notas/ModalEditarModelo";
import { ModalEditarContenido } from "@/components/secretaria/modelos-notas/ModalEditarContenido";
import type { TipoNota, ModeloNota } from "@/components/secretaria/modelos-notas/types";

export function ModelosNotasContent() {
  const [tipos, setTipos] = useState<TipoNota[]>([]);
  const [modelos, setModelos] = useState<ModeloNota[]>([]);
  const [loadingTipos, setLoadingTipos] = useState(true);
  const [loadingModelos, setLoadingModelos] = useState(true);
  const [search, setSearch] = useState("");
  const [searchDebounced, setSearchDebounced] = useState("");
  const [filtroTipo, setFiltroTipo] = useState<string>("todos");
  const [filtroEstado, setFiltroEstado] = useState<string>("todos");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  const [modalSubirOpen, setModalSubirOpen] = useState(false);
  const [modalCargaMasivaOpen, setModalCargaMasivaOpen] = useState(false);
  const [modalEditarOpen, setModalEditarOpen] = useState(false);
  const [modeloEditar, setModeloEditar] = useState<ModeloNota | null>(null);
  const [modalContenidoOpen, setModalContenidoOpen] = useState(false);
  const [contenidoModeloId, setContenidoModeloId] = useState<number | null>(null);
  const [contenidoModeloNombre, setContenidoModeloNombre] = useState("");

  const [mensaje, setMensaje] = useState<{ tipo: "ok" | "error"; text: string } | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setSearchDebounced(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const fetchTipos = useCallback(async () => {
    setLoadingTipos(true);
    try {
      const res = await fetch("/api/secretaria/tipos-nota");
      const json = await res.json();
      if (res.ok) setTipos(json.data || []);
    } finally {
      setLoadingTipos(false);
    }
  }, []);

  const fetchModelos = useCallback(async () => {
    setLoadingModelos(true);
    try {
      const params = new URLSearchParams();
      if (searchDebounced) params.set("q", searchDebounced);
      if (filtroTipo !== "todos") params.set("tipoNotaId", filtroTipo);
      if (filtroEstado !== "todos") params.set("estado", filtroEstado);
      const res = await fetch(`/api/secretaria/modelos-nota?${params}`);
      const json = await res.json();
      if (res.ok) setModelos(json.data || []);
    } finally {
      setLoadingModelos(false);
    }
  }, [searchDebounced, filtroTipo, filtroEstado]);

  useEffect(() => {
    fetchTipos();
  }, [fetchTipos]);

  useEffect(() => {
    fetchModelos();
  }, [fetchModelos]);

  useEffect(() => {
    if (!mensaje) return;
    const t = setTimeout(() => setMensaje(null), 4000);
    return () => clearTimeout(t);
  }, [mensaje]);

  const showMessage = useCallback((tipo: "ok" | "error", text: string) => {
    setMensaje({ tipo, text });
  }, []);

  const tiposActivos = tipos.filter((t) => t.activo);

  const handleDownload = (m: ModeloNota) => {
    window.open(`/api/secretaria/modelos-nota/${m.id}/download`, "_blank");
  };

  const handleExportZip = async () => {
    if (selectedIds.size === 0) return;
    try {
      const res = await fetch("/api/secretaria/modelos-nota/exportar-zip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(selectedIds) }),
      });
      if (!res.ok) {
        showMessage("error", "Error al generar ZIP");
        return;
      }
      const blob = await res.blob();
      const disp = res.headers.get("Content-Disposition");
      const match = disp?.match(/filename="?([^";]+)"?/);
      const filename = match?.[1] ?? "modelos_notas.zip";
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      a.click();
      URL.revokeObjectURL(a.href);
      showMessage("ok", "ZIP descargado.");
    } catch {
      showMessage("error", "Error al exportar");
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`¿Eliminar ${selectedIds.size} modelo(s) seleccionado(s)?`))
      return;
    let ok = 0;
    for (const id of selectedIds) {
      const res = await fetch(`/api/secretaria/modelos-nota/${id}`, {
        method: "DELETE",
      });
      if (res.ok) ok++;
    }
    setSelectedIds(new Set());
    fetchModelos();
    showMessage("ok", `Se eliminaron ${ok} modelo(s).`);
  };

  const handleDeleteModelo = (m: ModeloNota) => {
    if (!confirm("¿Eliminar este modelo?")) return;
    fetch(`/api/secretaria/modelos-nota/${m.id}`, { method: "DELETE" })
      .then(async (res) => {
        const data = await res.json();
        if (res.ok) {
          showMessage("ok", "Modelo eliminado.");
          fetchModelos();
          setSelectedIds((prev) => {
            const next = new Set(prev);
            next.delete(m.id);
            return next;
          });
        } else {
          showMessage("error", data.error || "Error al eliminar");
        }
      })
      .catch(() => showMessage("error", "Error de conexión"));
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === modelos.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(modelos.map((x) => x.id)));
    }
  };

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="space-y-6 mt-6">
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

      <TiposNotaPanel
        tipos={tipos}
        loading={loadingTipos}
        onRefresh={fetchTipos}
        onModelosRefresh={fetchModelos}
        showMessage={showMessage}
      />

      <Card>
        <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-4">
          <CardTitle>Modelos de Notas</CardTitle>
          <div className="flex gap-2">
            <Button
              size="sm"
              className="bg-[#4CAF50] hover:bg-[#388E3C]"
              onClick={() => setModalSubirOpen(true)}
            >
              <Upload className="h-4 w-4 mr-1" />
              Subir modelo
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="border-blue-500 text-blue-600 hover:bg-blue-50"
              onClick={() => setModalCargaMasivaOpen(true)}
            >
              <FolderUp className="h-4 w-4 mr-1" />
              Carga masiva
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <BuscadorModelos
            search={search}
            onSearchChange={setSearch}
            filtroTipo={filtroTipo}
            onFiltroTipoChange={setFiltroTipo}
            filtroEstado={filtroEstado}
            onFiltroEstadoChange={setFiltroEstado}
            tipos={tipos}
          />

          <ModelosNotaTabla
            modelos={modelos}
            loading={loadingModelos}
            selectedIds={selectedIds}
            onSelectAll={toggleSelectAll}
            onSelectOne={toggleSelect}
            onEdit={(m) => {
              setModeloEditar(m);
              setModalEditarOpen(true);
            }}
            onEditContenido={(m) => {
              setContenidoModeloId(m.id);
              setContenidoModeloNombre(m.nombre);
              setModalContenidoOpen(true);
            }}
            onDownload={handleDownload}
            onDelete={handleDeleteModelo}
            onExportZip={handleExportZip}
            onDeleteSelected={handleDeleteSelected}
          />
        </CardContent>
      </Card>

      <ModalSubirModelo
        open={modalSubirOpen}
        onOpenChange={setModalSubirOpen}
        tiposActivos={tiposActivos}
        onSuccess={fetchModelos}
        showMessage={showMessage}
      />

      <ModalCargaMasiva
        open={modalCargaMasivaOpen}
        onOpenChange={setModalCargaMasivaOpen}
        tiposActivos={tiposActivos}
        onSuccess={fetchModelos}
        showMessage={showMessage}
      />

      <ModalEditarModelo
        open={modalEditarOpen}
        onOpenChange={setModalEditarOpen}
        modelo={modeloEditar}
        tipos={tipos}
        onSuccess={fetchModelos}
        showMessage={showMessage}
      />

      <ModalEditarContenido
        open={modalContenidoOpen}
        onOpenChange={setModalContenidoOpen}
        modeloId={contenidoModeloId}
        modeloNombre={contenidoModeloNombre}
        onSuccess={fetchModelos}
        showMessage={showMessage}
      />
    </div>
  );
}
