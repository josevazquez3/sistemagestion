"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FilePlus, FolderUp, Search } from "lucide-react";
import { CategoriasOrdenDiaPanel } from "./CategoriasOrdenDiaPanel";
import { DocumentosOrdenDiaTabla } from "./DocumentosOrdenDiaTabla";
import { ModalNuevoDocumentoOrdenDia } from "./ModalNuevoDocumentoOrdenDia";
import { ModalVerDocumentoOrdenDia } from "./ModalVerDocumentoOrdenDia";
import { ModalEditarDocumentoOrdenDia } from "./ModalEditarDocumentoOrdenDia";
import { ModalCargaMasivaOrdenDia } from "./ModalCargaMasivaOrdenDia";
import type { CategoriaOrdenDia, DocumentoOrdenDia } from "./types";

const PER_PAGE = 20;
const API_BASE = "/api/secretaria/orden-del-dia";

type OrdenDelDiaContentProps = {
  canEdit: boolean;
};

export function OrdenDelDiaContent({ canEdit }: OrdenDelDiaContentProps) {
  const [documentos, setDocumentos] = useState<DocumentoOrdenDia[]>([]);
  const [categorias, setCategorias] = useState<CategoriaOrdenDia[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [searchDebounced, setSearchDebounced] = useState("");
  const [categoriaId, setCategoriaId] = useState("");
  const [tipo, setTipo] = useState("");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [mensaje, setMensaje] = useState<{ tipo: "ok" | "error"; text: string } | null>(null);

  const [modalNuevoOpen, setModalNuevoOpen] = useState(false);
  const [modalCargaMasivaOpen, setModalCargaMasivaOpen] = useState(false);
  const [modalVerOpen, setModalVerOpen] = useState(false);
  const [modalEditarOpen, setModalEditarOpen] = useState(false);
  const [docVer, setDocVer] = useState<DocumentoOrdenDia | null>(null);
  const [docEditar, setDocEditar] = useState<DocumentoOrdenDia | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setSearchDebounced(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const fetchCategorias = useCallback(async () => {
    const res = await fetch(`${API_BASE}/categorias?activas=true`);
    const json = await res.json();
    if (res.ok) setCategorias(json.data ?? []);
  }, []);

  const fetchDocumentos = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("perPage", String(PER_PAGE));
      if (searchDebounced) params.set("q", searchDebounced);
      if (categoriaId && categoriaId !== "todos") params.set("categoriaId", categoriaId);
      if (tipo) params.set("tipo", tipo);
      if (desde) params.set("desde", desde);
      if (hasta) params.set("hasta", hasta);
      const res = await fetch(`${API_BASE}?${params}`);
      const json = await res.json();
      if (res.ok) {
        setDocumentos(json.data ?? []);
        setTotal(json.total ?? 0);
      }
    } finally {
      setLoading(false);
    }
  }, [page, searchDebounced, categoriaId, tipo, desde, hasta]);

  useEffect(() => {
    fetchCategorias();
  }, [fetchCategorias]);

  useEffect(() => {
    fetchDocumentos();
  }, [fetchDocumentos]);

  useEffect(() => {
    if (!mensaje) return;
    const t = setTimeout(() => setMensaje(null), 4000);
    return () => clearTimeout(t);
  }, [mensaje]);

  const showMessage = useCallback((tipo: "ok" | "error", text: string) => {
    setMensaje({ tipo, text });
  }, []);

  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));

  const handleDelete = (doc: DocumentoOrdenDia) => {
    if (!confirm("¿Estás seguro de eliminar este documento?")) return;
    fetch(`${API_BASE}/${doc.id}`, { method: "DELETE" })
      .then(async (res) => {
        const data = await res.json();
        if (res.ok) {
          showMessage("ok", "Documento eliminado.");
          fetchDocumentos();
        } else {
          showMessage("error", data.error || "Error al eliminar");
        }
      })
      .catch(() => showMessage("error", "Error de conexión"));
  };

  const handleDescargar = (doc: DocumentoOrdenDia) => {
    const a = document.createElement("a");
    a.href = `${API_BASE}/${doc.id}/download`;
    a.download = doc.nombreArchivo ?? "documento";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleImprimir = (doc: DocumentoOrdenDia) => {
    if (doc.tipoArchivo === "PDF") {
      const ventana = window.open(
        `${API_BASE}/${doc.id}/download?inline=true`,
        "_blank"
      );
      if (ventana) {
        ventana.addEventListener("load", () => ventana.print());
      }
    } else {
      window.open(`${API_BASE}/${doc.id}/print`, "_blank");
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

      <CategoriasOrdenDiaPanel
        canEdit={canEdit}
        showMessage={showMessage}
        onCategoriasChange={fetchCategorias}
      />

      <Card>
        <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-4">
          <CardTitle>Documentos</CardTitle>
          {canEdit && (
            <div className="flex gap-2">
              <Button
                size="sm"
                className="bg-[#4CAF50] hover:bg-[#388E3C]"
                onClick={() => setModalNuevoOpen(true)}
              >
                <FilePlus className="h-4 w-4 mr-1" />
                Nuevo documento
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
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2 items-center">
            <div className="relative min-w-[200px] flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Buscar por título, descripción, archivo, categoría..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <select
              value={categoriaId}
              onChange={(e) => setCategoriaId(e.target.value)}
              className="h-9 rounded-md border border-gray-300 bg-white px-3 text-sm"
            >
              <option value="todos">Todas las categorías</option>
              {categorias.map((c) => (
                <option key={c.id} value={c.id}>{c.nombre}</option>
              ))}
            </select>
            <select
              value={tipo}
              onChange={(e) => setTipo(e.target.value)}
              className="h-9 rounded-md border border-gray-300 bg-white px-3 text-sm"
            >
              <option value="">Todos los tipos</option>
              <option value="PDF">PDF</option>
              <option value="DOCX">DOCX</option>
            </select>
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
          </div>

          <DocumentosOrdenDiaTabla
            documentos={documentos}
            loading={loading}
            canEdit={canEdit}
            onVer={(d) => { setDocVer(d); setModalVerOpen(true); }}
            onEditar={(d) => { setDocEditar(d); setModalEditarOpen(true); }}
            onEliminar={handleDelete}
            onDescargar={handleDescargar}
            onImprimir={handleImprimir}
          />

          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-600">
                Página {page} de {totalPages} ({total} documentos)
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

      <ModalNuevoDocumentoOrdenDia
        open={modalNuevoOpen}
        onOpenChange={setModalNuevoOpen}
        categorias={categorias}
        onSuccess={fetchDocumentos}
        showMessage={showMessage}
      />

      <ModalCargaMasivaOrdenDia
        open={modalCargaMasivaOpen}
        onOpenChange={setModalCargaMasivaOpen}
        categorias={categorias}
        onSuccess={fetchDocumentos}
        showMessage={showMessage}
      />

      <ModalVerDocumentoOrdenDia
        open={modalVerOpen}
        onOpenChange={setModalVerOpen}
        documento={docVer}
      />

      <ModalEditarDocumentoOrdenDia
        open={modalEditarOpen}
        onOpenChange={setModalEditarOpen}
        documento={docEditar}
        categorias={categorias}
        onSuccess={fetchDocumentos}
        showMessage={showMessage}
      />
    </div>
  );
}
