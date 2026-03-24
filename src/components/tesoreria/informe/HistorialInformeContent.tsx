"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Download, Pencil, Search, Trash2, Upload } from "lucide-react";
import { formatearFechaUTC } from "@/lib/utils/fecha";
import * as XLSX from "xlsx";

type HistorialItem = {
  id: number;
  nombreArchivo: string;
  fechaArchivo: string | null;
  createdAt: string;
};

export function HistorialInformeContent() {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<HistorialItem[]>([]);
  const [q, setQ] = useState("");
  const [importing, setImporting] = useState(false);
  const [previewFile, setPreviewFile] = useState<File | null>(null);
  const [previewRows, setPreviewRows] = useState<unknown[][]>([]);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [workingId, setWorkingId] = useState<number | null>(null);
  const [mensaje, setMensaje] = useState<{ tipo: "ok" | "error"; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (q.trim()) qs.set("q", q.trim());
      const res = await fetch(`/api/tesoreria/informe/historial${qs.toString() ? `?${qs}` : ""}`);
      const data = await res.json();
      if (!res.ok) {
        setMensaje({ tipo: "error", text: data?.error || "Error al cargar historial." });
        setItems([]);
        return;
      }
      setItems(Array.isArray(data) ? (data as HistorialItem[]) : []);
    } catch {
      setItems([]);
      setMensaje({ tipo: "error", text: "Error de conexión." });
    } finally {
      setLoading(false);
    }
  }, [q]);

  useEffect(() => {
    const t = setTimeout(() => {
      void load();
    }, 250);
    return () => clearTimeout(t);
  }, [load]);

  useEffect(() => {
    if (!mensaje) return;
    const t = setTimeout(() => setMensaje(null), 4000);
    return () => clearTimeout(t);
  }, [mensaje]);

  const itemsFiltrados = useMemo(() => items, [items]);

  const onImport = async (file: File) => {
    setImporting(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/tesoreria/informe/historial", { method: "POST", body: fd });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMensaje({ tipo: "error", text: j?.error || "No se pudo importar el Excel." });
        return;
      }
      setMensaje({ tipo: "ok", text: "Archivo importado al historial." });
      setItems((prev) => [j as HistorialItem, ...prev]);
    } catch {
      setMensaje({ tipo: "error", text: "Error de conexión al importar." });
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const onPrepararPreview = async (file: File) => {
    setPreviewError(null);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const firstSheet = wb.SheetNames[0];
      if (!firstSheet) {
        setPreviewError("El archivo no contiene hojas.");
        setPreviewFile(null);
        setPreviewRows([]);
        return;
      }
      const ws = wb.Sheets[firstSheet];
      const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: true, defval: "" });
      setPreviewFile(file);
      setPreviewRows(rows.slice(0, 10));
    } catch {
      setPreviewError("No se pudo leer el archivo Excel.");
      setPreviewFile(null);
      setPreviewRows([]);
    }
  };

  const onEditar = async (it: HistorialItem) => {
    const nombre = prompt("Nombre del archivo", it.nombreArchivo);
    if (!nombre || !nombre.trim()) return;
    setWorkingId(it.id);
    try {
      const res = await fetch(`/api/tesoreria/informe/historial/${it.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombreArchivo: nombre.trim() }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMensaje({ tipo: "error", text: j?.error || "No se pudo editar." });
        return;
      }
      setItems((prev) => prev.map((x) => (x.id === it.id ? { ...x, nombreArchivo: j.nombreArchivo } : x)));
      setMensaje({ tipo: "ok", text: "Nombre actualizado." });
    } finally {
      setWorkingId(null);
    }
  };

  const onEliminar = async (it: HistorialItem) => {
    if (!confirm("¿Eliminar este archivo del historial?")) return;
    setWorkingId(it.id);
    try {
      const res = await fetch(`/api/tesoreria/informe/historial/${it.id}`, { method: "DELETE" });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMensaje({ tipo: "error", text: j?.error || "No se pudo eliminar." });
        return;
      }
      setItems((prev) => prev.filter((x) => x.id !== it.id));
      setMensaje({ tipo: "ok", text: "Archivo eliminado." });
    } finally {
      setWorkingId(null);
    }
  };

  const onExportar = (it: HistorialItem) => {
    window.open(`/api/tesoreria/informe/historial/${it.id}/export`, "_blank");
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
          <div className="flex flex-wrap items-center gap-2 justify-between">
            <div className="relative w-full max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                className="pl-9"
                placeholder="Buscar por nombre de archivo..."
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void onPrepararPreview(f);
                }}
              />
              <Button
                type="button"
                className="bg-green-600 hover:bg-green-700 text-white"
                onClick={() => fileRef.current?.click()}
                disabled={importing}
              >
                <Upload className="w-4 h-4 mr-2" />
                {importing ? "Importando..." : "Importar (Excel)"}
              </Button>
            </div>
          </div>

          {previewError && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              {previewError}
            </div>
          )}

          {previewFile && (
            <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-medium text-gray-800">Vista previa de importación</p>
                  <p className="text-xs text-gray-600">{previewFile.name}</p>
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    className="bg-green-600 hover:bg-green-700 text-white"
                    disabled={importing}
                    onClick={() => void onImport(previewFile)}
                  >
                    {importing ? "Importando..." : "Confirmar importación"}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={importing}
                    onClick={() => {
                      setPreviewFile(null);
                      setPreviewRows([]);
                      setPreviewError(null);
                      if (fileRef.current) fileRef.current.value = "";
                    }}
                  >
                    Cancelar
                  </Button>
                </div>
              </div>
              <div className="border rounded bg-white overflow-x-auto">
                <table className="w-full text-xs">
                  <tbody>
                    {previewRows.length === 0 ? (
                      <tr>
                        <td className="p-2 text-gray-500">Sin filas para mostrar.</td>
                      </tr>
                    ) : (
                      previewRows.map((row, idx) => (
                        <tr key={idx} className="border-b last:border-b-0">
                          {(Array.isArray(row) ? row : []).slice(0, 8).map((cell, cIdx) => (
                            <td key={cIdx} className="p-2 whitespace-nowrap">
                              {String(cell ?? "")}
                            </td>
                          ))}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {loading ? (
            <p className="text-muted-foreground py-8 text-center">Cargando…</p>
          ) : itemsFiltrados.length === 0 ? (
            <p className="text-muted-foreground py-8 text-center">No hay archivos en el historial.</p>
          ) : (
            <div className="border rounded-lg overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-gray-600">
                    <th className="p-3 pl-4">Fecha (DD/MM/YYYY)</th>
                    <th className="p-3">Nombre del archivo</th>
                    <th className="p-3 text-right pr-4">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {itemsFiltrados.map((it) => (
                    <tr key={it.id} className="border-b hover:bg-muted/40">
                      <td className="p-3 pl-4 whitespace-nowrap">
                        {it.fechaArchivo ? formatearFechaUTC(new Date(it.fechaArchivo)) : "—"}
                      </td>
                      <td className="p-3">{it.nombreArchivo}</td>
                      <td className="p-3 pr-4">
                        <div className="flex justify-end gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={workingId === it.id}
                            onClick={() => void onEditar(it)}
                          >
                            <Pencil className="w-4 h-4 mr-1" />
                            Editar
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={workingId === it.id}
                            onClick={() => onExportar(it)}
                          >
                            <Download className="w-4 h-4 mr-1" />
                            Exportar
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="destructive"
                            disabled={workingId === it.id}
                            onClick={() => void onEliminar(it)}
                          >
                            <Trash2 className="w-4 h-4 mr-1" />
                            Borrar
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

