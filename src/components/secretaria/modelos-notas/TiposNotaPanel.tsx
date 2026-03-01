"use client";

import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PlusCircle, Pencil, Trash2, ChevronDown, ChevronRight, Loader2 } from "lucide-react";
import type { TipoNota } from "./types";

type TiposNotaPanelProps = {
  tipos: TipoNota[];
  loading: boolean;
  onRefresh: () => void;
  onModelosRefresh: () => void;
  showMessage: (type: "ok" | "error", text: string) => void;
};

export function TiposNotaPanel({
  tipos,
  loading,
  onRefresh,
  onModelosRefresh,
  showMessage,
}: TiposNotaPanelProps) {
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [saving, setSaving] = useState(false);

  const openNew = useCallback(() => {
    setEditId(null);
    setNombre("");
    setDescripcion("");
    setOpen(true);
  }, []);

  const openEdit = useCallback((t: TipoNota) => {
    setEditId(t.id);
    setNombre(t.nombre);
    setDescripcion(t.descripcion || "");
    setOpen(true);
  }, []);

  const save = useCallback(async () => {
    if (!nombre.trim()) {
      showMessage("error", "El nombre es obligatorio.");
      return;
    }
    setSaving(true);
    try {
      const url = editId
        ? `/api/secretaria/tipos-nota/${editId}`
        : "/api/secretaria/tipos-nota";
      const method = editId ? "PUT" : "POST";
      const body =
        editId
          ? { nombre: nombre.trim(), descripcion: descripcion.trim() || null }
          : { nombre: nombre.trim(), descripcion: descripcion.trim() || null };
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        showMessage("error", data.error || "Error al guardar");
        return;
      }
      showMessage("ok", editId ? "Tipo actualizado." : "Tipo creado.");
      setOpen(false);
      onRefresh();
      onModelosRefresh();
    } finally {
      setSaving(false);
    }
  }, [editId, nombre, descripcion, showMessage, onRefresh, onModelosRefresh]);

  const toggleActivo = useCallback(
    async (t: TipoNota) => {
      try {
        const res = await fetch(`/api/secretaria/tipos-nota/${t.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ activo: !t.activo }),
        });
        const data = await res.json();
        if (!res.ok) {
          showMessage("error", data.error || "Error al actualizar");
          return;
        }
        showMessage("ok", t.activo ? "Tipo desactivado." : "Tipo activado.");
        onRefresh();
        onModelosRefresh();
      } catch {
        showMessage("error", "Error de conexión");
      }
    },
    [showMessage, onRefresh, onModelosRefresh]
  );

  const deleteTipo = useCallback(
    async (t: TipoNota) => {
      if (t.cantidadModelos > 0) {
        showMessage("error", "No se puede eliminar: tiene modelos asociados.");
        return;
      }
      if (!confirm("¿Eliminar este tipo?")) return;
      try {
        const res = await fetch(`/api/secretaria/tipos-nota/${t.id}`, {
          method: "DELETE",
        });
        const data = await res.json();
        if (!res.ok) {
          showMessage("error", data.error || "Error al eliminar");
          return;
        }
        showMessage("ok", "Tipo eliminado.");
        setOpen(false);
        onRefresh();
      } catch {
        showMessage("error", "Error de conexión");
      }
    },
    [showMessage, onRefresh]
  );

  return (
    <>
      <Card>
        <CardHeader
          className="cursor-pointer flex flex-row items-center justify-between"
          onClick={() => setCollapsed(!collapsed)}
        >
          <div className="flex items-center gap-2">
            {collapsed ? (
              <ChevronRight className="h-5 w-5 text-gray-500" />
            ) : (
              <ChevronDown className="h-5 w-5 text-gray-500" />
            )}
            <CardTitle>Tipos de Nota</CardTitle>
          </div>
          <Button
            size="sm"
            className="bg-[#4CAF50] hover:bg-[#388E3C]"
            onClick={(e) => {
              e.stopPropagation();
              openNew();
            }}
          >
            <PlusCircle className="h-4 w-4 mr-1" />
            Nuevo tipo
          </Button>
        </CardHeader>
        {!collapsed && (
          <CardContent>
            {loading ? (
              <div className="flex items-center gap-2 text-gray-500 py-4">
                <Loader2 className="h-5 w-5 animate-spin" />
                Cargando tipos...
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nombre</TableHead>
                      <TableHead>Descripción</TableHead>
                      <TableHead>Cantidad de modelos</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tipos.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={5}
                          className="text-center text-gray-500 py-6"
                        >
                          No hay tipos de nota. Creá uno con &quot;Nuevo tipo&quot;.
                        </TableCell>
                      </TableRow>
                    ) : (
                      tipos.map((t) => (
                        <TableRow key={t.id}>
                          <TableCell className="font-medium">{t.nombre}</TableCell>
                          <TableCell className="text-gray-600">
                            {t.descripcion || "—"}
                          </TableCell>
                          <TableCell>{t.cantidadModelos}</TableCell>
                          <TableCell>
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                                t.activo
                                  ? "bg-green-100 text-green-800"
                                  : "bg-gray-100 text-gray-600"
                              }`}
                            >
                              {t.activo ? "Activo" : "Inactivo"}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openEdit(t)}
                              className="text-gray-600"
                              title="Editar"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => toggleActivo(t)}
                              title={t.activo ? "Desactivar" : "Activar"}
                            >
                              {t.activo ? "Desactivar" : "Activar"}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => deleteTipo(t)}
                              disabled={t.cantidadModelos > 0}
                              className="text-red-600 hover:text-red-700"
                              title={
                                t.cantidadModelos > 0
                                  ? "No se puede eliminar: tiene modelos"
                                  : "Eliminar"
                              }
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        )}
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editId ? "Editar tipo de nota" : "Nuevo tipo de nota"}
            </DialogTitle>
            <DialogDescription>Completá los datos del tipo.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nombre *
              </label>
              <Input
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="ej: Salutaciones, Citaciones"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Descripción (opcional)
              </label>
              <Input
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                placeholder="Breve descripción"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button
              className="bg-[#4CAF50] hover:bg-[#388E3C]"
              onClick={save}
              disabled={saving}
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Guardar"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
