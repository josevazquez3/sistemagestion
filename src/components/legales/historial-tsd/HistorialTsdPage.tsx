"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
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
import { FilePlus, FolderUp, Search, Eye, Pencil, Trash2, Printer } from "lucide-react";
import { ModalNuevoOficioTsd } from "./ModalNuevoOficioTsd";
import { ModalCargaMasivaTsd } from "./ModalCargaMasivaTsd";
import type { HistorialTsdRow } from "./types";
import { parsearFechaSegura, fechaSeguraParaPrisma } from "@/lib/utils/fecha";
import {
  deleteHistorialTsd,
} from "@/lib/actions/legal-historial-tsd.actions";

const TZ = "America/Argentina/Buenos_Aires";

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
      hour12: true,
    });
  } catch {
    return iso.slice(0, 16);
  }
}

function filaVisible(
  row: HistorialTsdRow,
  searchQ: string,
  desdeStr: string,
  hastaStr: string
): boolean {
  const q = searchQ.trim().toLowerCase();
  if (q) {
    const enTitulo = row.titulo.toLowerCase().includes(q);
    const enArchivo = (row.archivoNombre ?? "").toLowerCase().includes(q);
    if (!enTitulo && !enArchivo) return false;
  }
  const rowDia = fechaSeguraParaPrisma(new Date(row.fechaOficio));
  if (desdeStr.trim()) {
    const d = parsearFechaSegura(desdeStr.trim());
    if (d && rowDia.getTime() < d.getTime()) return false;
  }
  if (hastaStr.trim()) {
    const h = parsearFechaSegura(hastaStr.trim());
    if (h && rowDia.getTime() > h.getTime()) return false;
  }
  return true;
}

type HistorialTsdPageProps = {
  initialData: HistorialTsdRow[];
};

export function HistorialTsdPage({ initialData }: HistorialTsdPageProps) {
  const router = useRouter();
  const [rows, setRows] = useState<HistorialTsdRow[]>(initialData);
  const [search, setSearch] = useState("");
  const [searchDebounced, setSearchDebounced] = useState("");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [mensaje, setMensaje] = useState<{ tipo: "ok" | "error"; text: string } | null>(null);

  const [modalNuevaOpen, setModalNuevaOpen] = useState(false);
  const [modalCargaMasivaOpen, setModalCargaMasivaOpen] = useState(false);
  const [modalEditarOpen, setModalEditarOpen] = useState(false);
  const [editRow, setEditRow] = useState<HistorialTsdRow | null>(null);

  useEffect(() => {
    setRows(initialData);
  }, [initialData]);

  useEffect(() => {
    const t = setTimeout(() => setSearchDebounced(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const filtrados = useMemo(
    () => rows.filter((r) => filaVisible(r, searchDebounced, desde, hasta)),
    [rows, searchDebounced, desde, hasta]
  );

  useEffect(() => {
    if (!mensaje) return;
    const t = setTimeout(() => setMensaje(null), 4000);
    return () => clearTimeout(t);
  }, [mensaje]);

  const showMessage = useCallback((tipo: "ok" | "error", text: string) => {
    setMensaje({ tipo, text });
  }, []);

  const refrescar = useCallback(() => {
    router.refresh();
  }, [router]);

  const handleDelete = async (row: HistorialTsdRow) => {
    if (!confirm("¿Estás seguro de eliminar este registro?")) return;
    const res = await deleteHistorialTsd(row.id);
    if (res.error) {
      showMessage("error", res.error);
      return;
    }
    showMessage("ok", "Registro eliminado.");
    refrescar();
  };

  const abrirArchivo = (row: HistorialTsdRow) => {
    if (row.archivoUrl) window.open(row.archivoUrl, "_blank", "noopener,noreferrer");
  };

  const handleImprimir = (row: HistorialTsdRow) => {
    if (!row.archivoUrl) return;
    const ventana = window.open(row.archivoUrl, "_blank", "noopener,noreferrer");
    if (ventana) {
      ventana.addEventListener("load", () => {
        try {
          ventana.print();
        } catch {
          /* cross-origin */
        }
      });
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
            <CardTitle>Historial Exptes. TSD</CardTitle>
            <div className="flex flex-wrap gap-2 items-center">
              <div className="relative min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Buscar por título, archivo..."
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
                onClick={() => {
                  setEditRow(null);
                  setModalNuevaOpen(true);
                }}
              >
                <FilePlus className="h-4 w-4 mr-1" />
                Sentencias
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
            <div className="border rounded-lg overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Título</TableHead>
                    <TableHead>Fecha sentencia</TableHead>
                    <TableHead>Archivo</TableHead>
                    <TableHead>Fecha de carga</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtrados.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-gray-500">
                        No hay registros para mostrar.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filtrados.map((row) => (
                        <TableRow key={row.id}>
                          <TableCell className="font-medium max-w-[220px]">
                            <span
                              className={`block ${row.titulo.length > 48 ? "truncate" : ""}`}
                              title={row.titulo.length > 48 ? row.titulo : undefined}
                            >
                              {row.titulo}
                            </span>
                          </TableCell>
                          <TableCell>{formatFecha(row.fechaOficio)}</TableCell>
                          <TableCell className="max-w-[160px]">
                            {row.archivoUrl && row.archivoNombre ? (
                              <button
                                type="button"
                                onClick={() => abrirArchivo(row)}
                                className="text-[#388E3C] hover:underline text-sm truncate max-w-full block text-left"
                                title={row.archivoNombre}
                              >
                                {row.archivoNombre}
                              </button>
                            ) : (
                              <span className="text-gray-400">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-gray-600 text-sm whitespace-nowrap">
                            {formatFechaHora(row.fechaCarga)}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 w-8 p-0"
                                disabled={!row.archivoUrl}
                                onClick={() => abrirArchivo(row)}
                                title="Ver"
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 w-8 p-0 hover:bg-[#E8F5E9] hover:text-[#388E3C]"
                                onClick={() => {
                                  setEditRow(row);
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
                                onClick={() => handleDelete(row)}
                                title="Eliminar"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                              {row.archivoUrl ? (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-8 w-8 p-0 text-gray-600 hover:bg-gray-100"
                                  onClick={() => handleImprimir(row)}
                                  title={row.archivoNombre ? `Imprimir ${row.archivoNombre}` : "Imprimir"}
                                >
                                  <Printer className="h-4 w-4" />
                                </Button>
                              ) : null}
                            </div>
                          </TableCell>
                        </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <ModalNuevoOficioTsd
          open={modalNuevaOpen}
          onOpenChange={setModalNuevaOpen}
          modo="crear"
          registro={null}
          onSuccess={refrescar}
          showMessage={showMessage}
        />

        <ModalNuevoOficioTsd
          open={modalEditarOpen}
          onOpenChange={(o) => {
            setModalEditarOpen(o);
            if (!o) setEditRow(null);
          }}
          modo="editar"
          registro={editRow}
          onSuccess={refrescar}
          showMessage={showMessage}
        />

        <ModalCargaMasivaTsd
          open={modalCargaMasivaOpen}
          onOpenChange={setModalCargaMasivaOpen}
          onSuccess={refrescar}
          showMessage={showMessage}
        />
    </div>
  );
}
