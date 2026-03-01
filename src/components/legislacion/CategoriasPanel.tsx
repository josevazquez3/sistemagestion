"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { ChevronDown, ChevronRight, Plus, Pencil, Trash2, Loader2 } from "lucide-react";
import type { CategoriaLegislacion } from "./types";

type CategoriasPanelProps = {
  canEdit: boolean;
  showMessage: (type: "ok" | "error", text: string) => void;
  onCategoriasChange: () => void;
};

export function CategoriasPanel({
  canEdit,
  showMessage,
  onCategoriasChange,
}: CategoriasPanelProps) {
  const [abierto, setAbierto] = useState(false);
  const [categorias, setCategorias] = useState<CategoriaLegislacion[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalNueva, setModalNueva] = useState(false);
  const [modalEditar, setModalEditar] = useState(false);
  const [categoriaEditar, setCategoriaEditar] = useState<CategoriaLegislacion | null>(null);
  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchCategorias = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/legislacion/categorias");
      const json = await res.json();
      if (res.ok) setCategorias(json.data ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (canEdit && abierto) fetchCategorias();
  }, [canEdit, abierto, fetchCategorias]);

  const handleCrear = async () => {
    if (!nombre.trim()) {
      showMessage("error", "El nombre es obligatorio.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/legislacion/categorias", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre: nombre.trim(), descripcion: descripcion.trim() || null }),
      });
      const data = await res.json();
      if (!res.ok) {
        showMessage("error", data.error || "Error al crear");
        return;
      }
      showMessage("ok", "Categoría creada.");
      setModalNueva(false);
      setNombre("");
      setDescripcion("");
      fetchCategorias();
      onCategoriasChange();
    } finally {
      setSaving(false);
    }
  };

  const handleActualizar = async () => {
    if (!categoriaEditar) return;
    if (!nombre.trim()) {
      showMessage("error", "El nombre es obligatorio.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/legislacion/categorias/${categoriaEditar.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre: nombre.trim(), descripcion: descripcion.trim() || null }),
      });
      const data = await res.json();
      if (!res.ok) {
        showMessage("error", data.error || "Error al actualizar");
        return;
      }
      showMessage("ok", "Categoría actualizada.");
      setModalEditar(false);
      setCategoriaEditar(null);
      fetchCategorias();
      onCategoriasChange();
    } finally {
      setSaving(false);
    }
  };

  const toggleActivo = async (c: CategoriaLegislacion) => {
    try {
      const res = await fetch(`/api/legislacion/categorias/${c.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activo: !c.activo }),
      });
      const data = await res.json();
      if (!res.ok) {
        showMessage("error", data.error || "Error");
        return;
      }
      showMessage("ok", c.activo ? "Categoría desactivada." : "Categoría activada.");
      fetchCategorias();
      onCategoriasChange();
    } catch {
      showMessage("error", "Error de conexión");
    }
  };

  const handleEliminar = async (c: CategoriaLegislacion) => {
    const count = c.cantidadDocumentos ?? 0;
    if (count > 0) {
      showMessage("error", "No se puede eliminar una categoría con documentos asociados.");
      return;
    }
    if (!confirm("¿Eliminar esta categoría?")) return;
    try {
      const res = await fetch(`/api/legislacion/categorias/${c.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        showMessage("error", data.error || "Error al eliminar");
        return;
      }
      showMessage("ok", "Categoría eliminada.");
      fetchCategorias();
      onCategoriasChange();
    } catch {
      showMessage("error", "Error de conexión");
    }
  };

  if (!canEdit) return null;

  return (
    <div className="border rounded-lg overflow-hidden mb-6">
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        className="w-full flex items-center justify-between gap-2 px-4 py-3 bg-gray-50 hover:bg-gray-100 text-left font-medium"
      >
        <span className="flex items-center gap-2">
          {abierto ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          Categorías
        </span>
        <Button
          size="sm"
          variant="outline"
          onClick={(e) => {
            e.stopPropagation();
            setNombre("");
            setDescripcion("");
            setModalNueva(true);
          }}
        >
          <Plus className="h-4 w-4 mr-1" />
          Nueva categoría
        </Button>
      </button>
      {abierto && (
        <div className="p-4 border-t">
          {loading ? (
            <div className="flex justify-center py-4">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Descripción</TableHead>
                  <TableHead>Cantidad docs</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {categorias.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-gray-500 py-4">
                      No hay categorías. Creá una con el botón "Nueva categoría".
                    </TableCell>
                  </TableRow>
                ) : (
                  categorias.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.nombre}</TableCell>
                      <TableCell className="text-gray-600 max-w-[200px] truncate">
                        {c.descripcion || "—"}
                      </TableCell>
                      <TableCell>{c.cantidadDocumentos ?? 0}</TableCell>
                      <TableCell>
                        <span className={c.activo ? "text-green-600" : "text-gray-400"}>
                          {c.activo ? "Activa" : "Inactiva"}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0 mr-1"
                          onClick={() => {
                            setCategoriaEditar(c);
                            setNombre(c.nombre);
                            setDescripcion(c.descripcion || "");
                            setModalEditar(true);
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0 mr-1"
                          onClick={() => toggleActivo(c)}
                        >
                          {c.activo ? "Desactivar" : "Activar"}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0 text-red-600 hover:bg-red-50"
                          onClick={() => handleEliminar(c)}
                          disabled={(c.cantidadDocumentos ?? 0) > 0}
                          title={(c.cantidadDocumentos ?? 0) > 0 ? "Hay documentos asociados" : "Eliminar"}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </div>
      )}

      <Dialog open={modalNueva} onOpenChange={setModalNueva}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nueva categoría</DialogTitle>
            <DialogDescription>Nombre y descripción opcional.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
              <input
                type="text"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                className="w-full h-9 rounded-md border border-gray-300 px-3 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
              <textarea
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                rows={2}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalNueva(false)}>Cancelar</Button>
            <Button onClick={handleCrear} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={modalEditar} onOpenChange={(open) => { if (!open) setCategoriaEditar(null); setModalEditar(open); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Editar categoría</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
              <input
                type="text"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                className="w-full h-9 rounded-md border border-gray-300 px-3 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
              <textarea
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                rows={2}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalEditar(false)}>Cancelar</Button>
            <Button onClick={handleActualizar} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Guardar cambios"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
