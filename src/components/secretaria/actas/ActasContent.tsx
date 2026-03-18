"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InputFecha } from "@/components/ui/InputFecha";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { FilePlus, FolderUp, Search, Eye, Pencil, Trash2, Printer, Loader2, FileText, FileDown } from "lucide-react";
import { ModalNuevaActa } from "./ModalNuevaActa";
import { ModalVerActa } from "./ModalVerActa";
import { ModalEditarActa } from "./ModalEditarActa";
import { ModalCargaMasivaActas } from "./ModalCargaMasivaActas";
import { exportarActaPDF, exportarActaDOCX } from "@/lib/exportarActas";
import type { Acta } from "./types";
import { esDocFormatoAntiguo } from "@/lib/legales/modelosOficioWordShared";
import { formatearFechaUTC } from "@/lib/utils/fecha";

const TZ = "America/Argentina/Buenos_Aires";

function etiquetaTipoArchivoActa(nombreArchivo: string): string | null {
  const l = nombreArchivo.toLowerCase();
  if (l.endsWith(".pdf")) return "PDF";
  if (l.endsWith(".docx")) return "DOCX";
  if (l.endsWith(".doc")) return "DOC";
  return null;
}
const PER_PAGE = 20;

function formatFecha(iso: string): string {
  try {
    return formatearFechaUTC(new Date(iso));
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

export function ActasContent() {
  const [data, setData] = useState<Acta[]>([]);
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
  const [actaVer, setActaVer] = useState<Acta | null>(null);
  const [actaEditar, setActaEditar] = useState<Acta | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setSearchDebounced(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const fetchActas = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("perPage", String(PER_PAGE));
      if (searchDebounced) params.set("q", searchDebounced);
      if (desde) params.set("desde", desde);
      if (hasta) params.set("hasta", hasta);
      const res = await fetch(`/api/secretaria/actas?${params}`);
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
    fetchActas();
  }, [fetchActas]);

  useEffect(() => {
    if (!mensaje) return;
    const t = setTimeout(() => setMensaje(null), 4000);
    return () => clearTimeout(t);
  }, [mensaje]);

  const showMessage = useCallback((tipo: "ok" | "error", text: string) => {
    setMensaje({ tipo, text });
  }, []);

  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));

  const handleDelete = (acta: Acta) => {
    if (!confirm("¿Estás seguro de eliminar esta acta?")) return;
    fetch(`/api/secretaria/actas/${acta.id}`, { method: "DELETE" })
      .then(async (res) => {
        const data = await res.json();
        if (res.ok) {
          showMessage("ok", "Acta eliminada.");
          fetchActas();
        } else {
          showMessage("error", data.error || "Error al eliminar");
        }
      })
      .catch(() => showMessage("error", "Error de conexión"));
  };

  const handleDownload = (acta: Acta) => {
    window.open(`/api/secretaria/actas/${acta.id}/download`, "_blank");
  };

  const handleImprimir = (acta: Acta) => {
    if (!acta.urlArchivo || !acta.nombreArchivo) return;
    const esPdf = acta.nombreArchivo.toLowerCase().endsWith(".pdf");
    if (esPdf) {
      const ventana = window.open(
        `/api/secretaria/actas/${acta.id}/download?inline=true`,
        "_blank"
      );
      if (ventana) {
        ventana.addEventListener("load", () => ventana.print());
      }
    } else {
      window.open(`/api/secretaria/actas/${acta.id}/print`, "_blank");
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
          <CardTitle>Actas</CardTitle>
          <div className="flex flex-wrap gap-2 items-center">
            <div className="relative min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Buscar por título, archivo o fecha..."
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
            <Button
              size="sm"
              className="bg-[#4CAF50] hover:bg-[#388E3C]"
              onClick={() => setModalNuevaOpen(true)}
            >
              <FilePlus className="h-4 w-4 mr-1" />
              Nueva Acta
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
                  <TableHead>Fecha del acta</TableHead>
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
                      No hay actas.
                    </TableCell>
                  </TableRow>
                ) : (
                  data.map((acta) => {
                    const badgeArchivo =
                      acta.nombreArchivo ? etiquetaTipoArchivoActa(acta.nombreArchivo) : null;
                    const esDocAntiguo = acta.nombreArchivo
                      ? esDocFormatoAntiguo(acta.nombreArchivo)
                      : false;
                    return (
                    <TableRow key={acta.id}>
                      <TableCell className="font-medium max-w-[200px] truncate" title={acta.titulo}>
                        {acta.titulo}
                      </TableCell>
                      <TableCell>{formatFecha(acta.fechaActa)}</TableCell>
                      <TableCell>
                        {acta.urlArchivo && acta.nombreArchivo ? (
                          <button
                            type="button"
                            onClick={() => handleDownload(acta)}
                            className="inline-flex items-center gap-2 text-left text-[#388E3C] hover:underline text-sm"
                          >
                            <FileText className="h-4 w-4 shrink-0 text-[#2E7D32]" aria-hidden />
                            <span>{acta.nombreArchivo}</span>
                            {badgeArchivo && (
                              <span className="rounded bg-[#E8F5E9] px-1.5 py-0.5 text-[10px] font-semibold uppercase text-[#2E7D32]">
                                {badgeArchivo}
                              </span>
                            )}
                          </button>
                        ) : (
                          <span className="text-gray-400">Sin archivo</span>
                        )}
                      </TableCell>
                      <TableCell className="text-gray-600 text-sm">
                        {formatFechaHora(acta.creadoEn)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center gap-2 justify-end">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0"
                            onClick={() => {
                              setActaVer(acta);
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
                              setActaEditar(acta);
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
                            onClick={() => handleDelete(acta)}
                            title="Eliminar"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0 text-red-600 hover:bg-red-50"
                            onClick={() => exportarActaPDF(acta)}
                            title="Exportar PDF"
                          >
                            <FileText className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0 text-blue-600 hover:bg-blue-50"
                            onClick={() => exportarActaDOCX(acta)}
                            title="Exportar DOCX"
                          >
                            <FileDown className="h-4 w-4" />
                          </Button>
                          {acta.urlArchivo && acta.nombreArchivo && (
                            <span
                              className="inline-flex"
                              title={
                                esDocAntiguo
                                  ? "Vista previa no disponible para archivos .doc"
                                  : `Imprimir ${acta.nombreArchivo}`
                              }
                            >
                              <Button
                                size="sm"
                                variant="ghost"
                                className={`h-8 w-8 p-0 text-gray-600 hover:bg-gray-100 ${
                                  esDocAntiguo ? "opacity-40 cursor-not-allowed" : ""
                                }`}
                                disabled={esDocAntiguo}
                                onClick={() => handleImprimir(acta)}
                              >
                                <Printer className="h-4 w-4" />
                              </Button>
                            </span>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-600">
                Página {page} de {totalPages} ({total} actas)
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

      <ModalNuevaActa
        open={modalNuevaOpen}
        onOpenChange={setModalNuevaOpen}
        onSuccess={fetchActas}
        showMessage={showMessage}
      />

      <ModalCargaMasivaActas
        open={modalCargaMasivaOpen}
        onOpenChange={setModalCargaMasivaOpen}
        onSuccess={fetchActas}
        showMessage={showMessage}
      />

      <ModalVerActa
        open={modalVerOpen}
        onOpenChange={setModalVerOpen}
        acta={actaVer}
      />

      <ModalEditarActa
        open={modalEditarOpen}
        onOpenChange={setModalEditarOpen}
        acta={actaEditar}
        onSuccess={fetchActas}
        showMessage={showMessage}
      />
    </div>
  );
}
