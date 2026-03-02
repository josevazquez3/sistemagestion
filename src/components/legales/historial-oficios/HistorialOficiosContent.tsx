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
import { FilePlus, FolderUp, Search, Eye, Pencil, Trash2, Loader2 } from "lucide-react";
import { ModalNuevoOficio } from "./ModalNuevoOficio";
import { ModalVerOficio } from "./ModalVerOficio";
import { ModalEditarOficio } from "./ModalEditarOficio";
import { ModalCargaMasivaOficios } from "./ModalCargaMasivaOficios";
import type { OficioRespondido } from "./types";

const TZ = "America/Argentina/Buenos_Aires";
const PER_PAGE = 20;

function formatFecha(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("es-AR", {
      timeZone: TZ,
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return iso.slice(0, 10);
  }
}

function formatFechaHora(iso: string): string {
  try {
    return new Date(iso).toLocaleString("es-AR", {
      timeZone: TZ,
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso.slice(0, 16);
  }
}

export function HistorialOficiosContent() {
  const [data, setData] = useState<OficioRespondido[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [searchDebounced, setSearchDebounced] = useState("");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [mensaje, setMensaje] = useState<{ tipo: "ok" | "error"; text: string } | null>(null);

  const [modalNuevaOpen, setModalNuevaOpen] = useState(false);
  const [modalCargaMasivaOpen, setModalCargaMasivaOpen] = useState(false);
  const [modalVerOpen, setModalVerOpen] = useState(false);
  const [modalEditarOpen, setModalEditarOpen] = useState(false);
  const [oficioVer, setOficioVer] = useState<OficioRespondido | null>(null);
  const [oficioEditar, setOficioEditar] = useState<OficioRespondido | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setSearchDebounced(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const fetchOficios = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("perPage", String(PER_PAGE));
      if (searchDebounced) params.set("q", searchDebounced);
      if (desde) params.set("desde", desde);
      if (hasta) params.set("hasta", hasta);
      const res = await fetch(`/api/legales/historial-oficios?${params}`);
      const json = await res.json();
      if (res.ok) {
        setData(json.data ?? []);
        setTotal(json.total ?? 0);
      }
    } finally {
      setLoading(false);
    }
  }, [page, searchDebounced, desde, hasta]);

  useEffect(() => {
    fetchOficios();
  }, [fetchOficios]);

  useEffect(() => {
    if (!mensaje) return;
    const t = setTimeout(() => setMensaje(null), 4000);
    return () => clearTimeout(t);
  }, [mensaje]);

  const showMessage = useCallback((tipo: "ok" | "error", text: string) => {
    setMensaje({ tipo, text });
  }, []);

  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));

  const handleDelete = (oficio: OficioRespondido) => {
    if (!confirm("¿Estás seguro de eliminar este oficio?")) return;
    fetch(`/api/legales/historial-oficios/${oficio.id}`, { method: "DELETE" })
      .then(async (res) => {
        const data = await res.json();
        if (res.ok) {
          showMessage("ok", "Oficio eliminado.");
          fetchOficios();
        } else {
          showMessage("error", data.error || "Error al eliminar");
        }
      })
      .catch(() => showMessage("error", "Error de conexión"));
  };

  const handleDownload = (oficio: OficioRespondido) => {
    window.open(`/api/legales/historial-oficios/${oficio.id}/download`, "_blank");
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
          <CardTitle>Historial de Oficios</CardTitle>
          <div className="flex flex-wrap gap-2 items-center">
            <div className="relative min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Buscar por título, archivo"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <input
              type="text"
              placeholder="Desde (DD/MM/YYYY)"
              value={desde}
              onChange={(e) => setDesde(e.target.value)}
              className="w-36 h-9 rounded-md border border-gray-300 px-3 text-sm"
            />
            <input
              type="text"
              placeholder="Hasta (DD/MM/YYYY)"
              value={hasta}
              onChange={(e) => setHasta(e.target.value)}
              className="w-36 h-9 rounded-md border border-gray-300 px-3 text-sm"
            />
            <Button
              size="sm"
              className="bg-[#4CAF50] hover:bg-[#388E3C]"
              onClick={() => setModalNuevaOpen(true)}
            >
              <FilePlus className="h-4 w-4 mr-1" />
              Nuevo Oficio
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="border-blue-500 text-blue-600 hover:bg-blue-50"
              onClick={() => setModalCargaMasivaOpen(true)}
            >
              <FolderUp className="h-4 w-4 mr-1" />
              Carga Masiva
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Título</TableHead>
                  <TableHead>Fecha del oficio</TableHead>
                  <TableHead>Archivo</TableHead>
                  <TableHead>Fecha de carga</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto text-gray-400" />
                    </TableCell>
                  </TableRow>
                ) : data.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-gray-500">
                      No hay oficios respondidos.
                    </TableCell>
                  </TableRow>
                ) : (
                  data.map((oficio) => (
                    <TableRow key={oficio.id}>
                      <TableCell className="font-medium max-w-[200px] truncate" title={oficio.titulo}>
                        {oficio.titulo}
                      </TableCell>
                      <TableCell>{formatFecha(oficio.fechaOficio)}</TableCell>
                      <TableCell>
                        {oficio.urlArchivo && oficio.nombreArchivo ? (
                          <button
                            type="button"
                            onClick={() => handleDownload(oficio)}
                            className="text-[#388E3C] hover:underline text-sm"
                          >
                            {oficio.nombreArchivo}
                          </button>
                        ) : (
                          <span className="text-gray-400">Sin archivo</span>
                        )}
                      </TableCell>
                      <TableCell className="text-gray-600 text-sm">
                        {formatFechaHora(oficio.creadoEn)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0"
                            onClick={() => {
                              setOficioVer(oficio);
                              setModalVerOpen(true);
                            }}
                            title="Ver"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0"
                            onClick={() => {
                              setOficioEditar(oficio);
                              setModalEditarOpen(true);
                            }}
                            title="Editar"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                            onClick={() => handleDelete(oficio)}
                            title="Eliminar"
                          >
                            <Trash2 className="h-4 w-4" />
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
                Página {page} de {totalPages} ({total} oficios)
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

      <ModalNuevoOficio
        open={modalNuevaOpen}
        onOpenChange={setModalNuevaOpen}
        onSuccess={fetchOficios}
        showMessage={showMessage}
      />

      <ModalCargaMasivaOficios
        open={modalCargaMasivaOpen}
        onOpenChange={setModalCargaMasivaOpen}
        onSuccess={fetchOficios}
        showMessage={showMessage}
      />

      <ModalVerOficio
        open={modalVerOpen}
        onOpenChange={setModalVerOpen}
        oficio={oficioVer}
      />

      <ModalEditarOficio
        open={modalEditarOpen}
        onOpenChange={setModalEditarOpen}
        oficio={oficioEditar}
        onSuccess={fetchOficios}
        showMessage={showMessage}
      />
    </div>
  );
}
