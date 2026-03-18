"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { FileText, FileDown, Plus, Pencil, Trash2, Loader2, Search, CheckCircle, RotateCcw } from "lucide-react";
import { ModalReunion } from "./ModalReunion";
import { InputFecha } from "@/components/ui/InputFecha";
import {
  exportarAgendaPDF,
  exportarAgendaDOCX,
  exportarReunionPDF,
  exportarReunionDOCX,
  type ReunionExport,
} from "@/lib/exportarAgenda";
import type { Reunion } from "./types";
import { formatearFechaUTC } from "@/lib/utils/fecha";

const TZ = "America/Argentina/Buenos_Aires";
const PER_PAGE = 20;
const API_BASE = "/api/secretaria/agenda";

function formatFecha(iso: string): string {
  try {
    return formatearFechaUTC(new Date(iso));
  } catch {
    return iso.slice(0, 10);
  }
}

function toReunionExport(r: Reunion): ReunionExport {
  return {
    id: r.id,
    fechaCarga: r.fechaCarga,
    organismo: r.organismo,
    fechaReunion: r.fechaReunion,
    hora: r.hora,
    observacion: r.observacion,
    estado: r.estado ?? "PENDIENTE",
    contactoNombre: r.contactoNombre,
    contactoApellido: r.contactoApellido,
    contactoCargo: r.contactoCargo,
    contactoTelefono: r.contactoTelefono,
    contactoMail: r.contactoMail,
  };
}

function contactoTexto(r: Reunion): string {
  const nombre = [r.contactoNombre, r.contactoApellido].filter(Boolean).join(" ");
  return nombre || "—";
}

function contactoTooltip(r: Reunion): string {
  const parts: string[] = [];
  if (r.contactoCargo) parts.push(`Cargo: ${r.contactoCargo}`);
  if (r.contactoTelefono) parts.push(`Teléfono: ${r.contactoTelefono}`);
  if (r.contactoMail) parts.push(`Mail: ${r.contactoMail}`);
  return parts.length ? parts.join("\n") : "";
}

export function AgendaContent() {
  const [data, setData] = useState<Reunion[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [searchDebounced, setSearchDebounced] = useState("");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("");
  const [mensaje, setMensaje] = useState<{ tipo: "ok" | "error"; text: string } | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [reunionEditar, setReunionEditar] = useState<Reunion | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setSearchDebounced(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const fetchReuniones = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("perPage", String(PER_PAGE));
      if (searchDebounced) params.set("q", searchDebounced);
      if (desde) params.set("desde", desde);
      if (hasta) params.set("hasta", hasta);
      if (filtroEstado) params.set("estado", filtroEstado);
      const res = await fetch(`${API_BASE}?${params}`);
      const json = await res.json();
      if (res.ok) {
        setData(json.data ?? []);
        setTotal(json.total ?? 0);
      }
    } finally {
      setLoading(false);
    }
  }, [page, searchDebounced, desde, hasta, filtroEstado]);

  useEffect(() => {
    fetchReuniones();
  }, [fetchReuniones]);

  useEffect(() => {
    if (!mensaje) return;
    const t = setTimeout(() => setMensaje(null), 4000);
    return () => clearTimeout(t);
  }, [mensaje]);

  const showMessage = useCallback((tipo: "ok" | "error", text: string) => {
    setMensaje({ tipo, text });
  }, []);

  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));

  const handleNueva = () => {
    setReunionEditar(null);
    setModalOpen(true);
  };

  const handleEditar = (r: Reunion) => {
    setReunionEditar(r);
    setModalOpen(true);
  };

  const handleDelete = (r: Reunion) => {
    if (!confirm("¿Estás seguro de eliminar esta reunión?")) return;
    fetch(`${API_BASE}/${r.id}`, { method: "DELETE" })
      .then(async (res) => {
        const data = await res.json();
        if (res.ok) {
          showMessage("ok", "Reunión eliminada.");
          fetchReuniones();
        } else {
          showMessage("error", data.error || "Error al eliminar");
        }
      })
      .catch(() => showMessage("error", "Error de conexión"));
  };

  const exportarPDFGlobal = () => {
    exportarAgendaPDF(data.map(toReunionExport));
  };

  const exportarDOCXGlobal = async () => {
    await exportarAgendaDOCX(data.map(toReunionExport));
  };

  const cambiarEstado = async (id: number, nuevoEstado: "PENDIENTE" | "FINALIZADA") => {
    try {
      const res = await fetch(`${API_BASE}/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estado: nuevoEstado }),
      });
      if (!res.ok) throw new Error("Error al cambiar estado");
      setData((prev) =>
        prev.map((r) => (r.id === id ? { ...r, estado: nuevoEstado } : r))
      );
    } catch {
      showMessage("error", "Error al cambiar el estado de la reunión");
    }
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

      <Card>
        <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-4">
          <CardTitle>Agenda</CardTitle>
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              size="sm"
              variant="outline"
              className="border-red-500 text-red-600 hover:bg-red-50"
              onClick={exportarPDFGlobal}
              disabled={data.length === 0}
            >
              <FileText className="h-4 w-4 mr-1" />
              Exportar PDF
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="border-blue-500 text-blue-600 hover:bg-blue-50"
              onClick={exportarDOCXGlobal}
              disabled={data.length === 0}
            >
              <FileDown className="h-4 w-4 mr-1" />
              Exportar DOCX
            </Button>
            <Button
              size="sm"
              className="bg-[#4CAF50] hover:bg-[#388E3C]"
              onClick={handleNueva}
            >
              <Plus className="h-4 w-4 mr-1" />
              Nueva Reunión
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2 items-center">
            <div className="relative min-w-[200px] flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Buscar por organismo, observación, contacto..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <InputFecha
              placeholder="Desde (DD/MM/YYYY)"
              value={desde}
              onChange={setDesde}
              className="w-36 h-9 rounded-md border border-gray-300 px-3 text-sm"
            />
            <InputFecha
              placeholder="Hasta (DD/MM/YYYY)"
              value={hasta}
              onChange={setHasta}
              className="w-36 h-9 rounded-md border border-gray-300 px-3 text-sm"
            />
            <select
              value={filtroEstado}
              onChange={(e) => setFiltroEstado(e.target.value)}
              className="h-9 rounded-md border border-gray-300 bg-white px-3 text-sm"
            >
              <option value="">Todos</option>
              <option value="PENDIENTE">Pendientes</option>
              <option value="FINALIZADA">Finalizadas</option>
            </select>
          </div>

          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[100px]">Fecha carga</TableHead>
                  <TableHead className="min-w-[160px]">Organismo / Institución</TableHead>
                  <TableHead className="w-[110px]">Fecha reunión</TableHead>
                  <TableHead className="w-[70px]">Hora</TableHead>
                  <TableHead className="max-w-[180px]">Observación</TableHead>
                  <TableHead className="min-w-[120px]">Contacto</TableHead>
                  <TableHead className="w-[100px]">Estado</TableHead>
                  <TableHead className="text-right w-[200px]">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto text-gray-400" />
                    </TableCell>
                  </TableRow>
                ) : data.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                      No hay reuniones.
                    </TableCell>
                  </TableRow>
                ) : (
                  data.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="text-sm">{formatFecha(r.fechaCarga)}</TableCell>
                      <TableCell
                        className="font-medium max-w-[160px] truncate"
                        title={r.organismo}
                      >
                        {r.organismo}
                      </TableCell>
                      <TableCell>{formatFecha(r.fechaReunion)}</TableCell>
                      <TableCell>{r.hora ?? "—"}</TableCell>
                      <TableCell
                        className="max-w-[180px] truncate text-gray-600"
                        title={r.observacion ?? ""}
                      >
                        {r.observacion
                          ? r.observacion.length > 40
                            ? r.observacion.slice(0, 40) + "..."
                            : r.observacion
                          : "—"}
                      </TableCell>
                      <TableCell
                        className="min-w-[120px]"
                        title={contactoTooltip(r)}
                      >
                        {contactoTexto(r)}
                      </TableCell>
                      <TableCell>
                        {r.estado === "PENDIENTE" ? (
                          <span className="px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700 border border-yellow-300">
                            Pendiente
                          </span>
                        ) : (
                          <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700 border border-green-300">
                            Finalizada
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center gap-2 justify-end">
                          {r.estado === "PENDIENTE" && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 w-8 p-0 text-green-600 hover:bg-green-50"
                              onClick={() => cambiarEstado(r.id, "FINALIZADA")}
                              title="Marcar como finalizada"
                            >
                              <CheckCircle className="h-4 w-4" />
                            </Button>
                          )}
                          {r.estado === "FINALIZADA" && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 w-8 p-0 text-red-500 hover:bg-red-50"
                              onClick={() => cambiarEstado(r.id, "PENDIENTE")}
                              title="Marcar como pendiente"
                            >
                              <RotateCcw className="h-4 w-4" />
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0"
                            onClick={() => handleEditar(r)}
                            title="Editar"
                          >
                            <Pencil className="h-4 w-4 text-gray-600" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0 text-red-600 hover:bg-red-50"
                            onClick={() => handleDelete(r)}
                            title="Eliminar"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0 text-red-600 hover:bg-red-50"
                            onClick={() => exportarReunionPDF(toReunionExport(r))}
                            title="Exportar PDF"
                          >
                            <FileText className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0 text-blue-600 hover:bg-blue-50"
                            onClick={() => exportarReunionDOCX(toReunionExport(r))}
                            title="Exportar DOCX"
                          >
                            <FileDown className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-600">
                Página {page} de {totalPages} ({total} reuniones)
              </p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  Anterior
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Siguiente
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <ModalReunion
        open={modalOpen}
        onOpenChange={setModalOpen}
        reunion={reunionEditar}
        onSuccess={fetchReuniones}
        showMessage={showMessage}
      />
    </div>
  );
}
