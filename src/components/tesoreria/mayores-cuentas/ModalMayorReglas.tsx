"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Check, Pencil, Trash2, X } from "lucide-react";
import type { MayorCuenta, MayorRegla } from "@/types/tesoreria";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cuentas: MayorCuenta[];
  showMessage: (tipo: "ok" | "error", text: string) => void;
};

export function ModalMayorReglas({ open, onOpenChange, cuentas, showMessage }: Props) {
  const [cargando, setCargando] = useState(false);
  const [reglas, setReglas] = useState<MayorRegla[]>([]);
  const [nuevaPalabra, setNuevaPalabra] = useState("");
  const [nuevaCuentaId, setNuevaCuentaId] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [editPalabra, setEditPalabra] = useState("");
  const [editCuentaId, setEditCuentaId] = useState("");
  const [editando, setEditando] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const res = await fetch("/api/tesoreria/mayor-reglas");
      const data = await res.json();
      if (res.ok && Array.isArray(data)) setReglas(data as MayorRegla[]);
      else {
        setReglas([]);
        if (!res.ok) showMessage("error", data?.error || "Error al cargar reglas");
      }
    } catch {
      setReglas([]);
      showMessage("error", "Error de conexión.");
    } finally {
      setCargando(false);
    }
  }, [showMessage]);

  useEffect(() => {
    if (open) void cargar();
  }, [open, cargar]);

  useEffect(() => {
    if (!open) {
      setEditId(null);
      setEditPalabra("");
      setEditCuentaId("");
      setEditando(false);
    }
  }, [open]);

  const agregar = async () => {
    const palabra = nuevaPalabra.trim();
    const cuentaId = parseInt(nuevaCuentaId, 10);
    if (!palabra) {
      showMessage("error", "Ingresá una palabra clave.");
      return;
    }
    if (!cuentaId || Number.isNaN(cuentaId)) {
      showMessage("error", "Elegí una cuenta.");
      return;
    }
    setGuardando(true);
    try {
      const res = await fetch("/api/tesoreria/mayor-reglas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ palabra, cuentaId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showMessage("error", data?.error || "Error al guardar.");
        return;
      }
      setNuevaPalabra("");
      setNuevaCuentaId("");
      showMessage("ok", "Regla guardada.");
      await cargar();
    } catch {
      showMessage("error", "Error de conexión.");
    } finally {
      setGuardando(false);
    }
  };

  const borrar = async (r: MayorRegla) => {
    if (!confirm(`¿Eliminar la regla "${r.palabra}"?`)) return;
    try {
      const res = await fetch(`/api/tesoreria/mayor-reglas/${r.id}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showMessage("error", data?.error || "Error al eliminar.");
        return;
      }
      showMessage("ok", "Regla eliminada.");
      await cargar();
    } catch {
      showMessage("error", "Error de conexión.");
    }
  };

  const startEditar = (r: MayorRegla) => {
    setEditId(r.id);
    setEditPalabra(r.palabra);
    setEditCuentaId(String(r.cuentaId));
  };

  const cancelarEditar = () => {
    setEditId(null);
    setEditPalabra("");
    setEditCuentaId("");
  };

  const guardarEdicion = async (r: MayorRegla) => {
    const palabra = editPalabra.trim();
    const cuentaId = parseInt(editCuentaId, 10);
    if (!palabra) {
      showMessage("error", "Ingresá una palabra clave.");
      return;
    }
    if (!cuentaId || Number.isNaN(cuentaId)) {
      showMessage("error", "Elegí una cuenta.");
      return;
    }
    setEditando(true);
    try {
      const res = await fetch(`/api/tesoreria/mayor-reglas/${r.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ palabra, cuentaId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showMessage("error", data?.error || "Error al actualizar.");
        return;
      }
      setReglas((prev) =>
        prev.map((x) =>
          x.id === r.id
            ? {
                ...x,
                palabra: data.palabra ?? palabra,
                cuentaId: data.cuentaId ?? cuentaId,
                cuentaNombre: data.cuentaNombre ?? x.cuentaNombre,
              }
            : x
        )
      );
      showMessage("ok", "Regla actualizada.");
      cancelarEditar();
    } finally {
      setEditando(false);
    }
  };

  const cuentasOrdenadas = [...cuentas].sort(
    (a, b) => a.orden - b.orden || a.id - b.id
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[92vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Reglas de asignación automática</DialogTitle>
          <p className="text-sm text-muted-foreground font-normal text-left">
            Si el concepto del movimiento contiene la palabra (sin distinguir mayúsculas), se sugiere
            esa cuenta. Al asignar desde extracto o fondo fijo, el sistema puede crear reglas
            aprendiendo las primeras palabras del concepto.
          </p>
        </DialogHeader>

        <div className="space-y-3 border rounded-md p-3 bg-muted/20">
          <p className="text-sm font-medium">Nueva regla manual</p>
          <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <div>
              <Label className="text-xs">Palabra clave</Label>
              <Input
                value={nuevaPalabra}
                onChange={(e) => setNuevaPalabra(e.target.value)}
                placeholder="ej. afip, transferencia"
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs">Cuenta del mayor</Label>
              <select
                className="mt-1 w-full border rounded-md px-2 py-2 text-sm bg-background h-9"
                value={nuevaCuentaId}
                onChange={(e) => setNuevaCuentaId(e.target.value)}
              >
                <option value="">Elegir…</option>
                {cuentasOrdenadas.map((c) => (
                  <option key={c.id} value={String(c.id)}>
                    {c.nombre}
                  </option>
                ))}
              </select>
            </div>
            <Button
              type="button"
              disabled={guardando || cuentas.length === 0}
              onClick={() => void agregar()}
            >
              Guardar
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-auto border rounded-md min-h-[320px]">
          {cargando ? (
            <p className="p-6 text-sm text-muted-foreground text-center">Cargando…</p>
          ) : reglas.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground text-center">
              No hay reglas. Se crearán al asignar movimientos o podés agregarlas arriba.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-muted/80">
                <tr className="border-b text-left">
                  <th className="p-2 pl-3">Palabra clave</th>
                  <th className="p-2">Cuenta asignada</th>
                  <th className="p-2 w-24 text-center pr-3"> </th>
                </tr>
              </thead>
              <tbody>
                {reglas.map((r) => (
                  <tr key={r.id} className="border-b hover:bg-muted/30">
                    <td className="p-2 pl-3 font-mono text-xs sm:text-sm">
                      {editId === r.id ? (
                        <Input
                          value={editPalabra}
                          onChange={(e) => setEditPalabra(e.target.value)}
                          className="h-9"
                        />
                      ) : (
                        r.palabra
                      )}
                    </td>
                    <td className="p-2">
                      {editId === r.id ? (
                        <select
                          className="w-full border rounded-md px-2 py-2 text-sm bg-background h-9"
                          value={editCuentaId}
                          onChange={(e) => setEditCuentaId(e.target.value)}
                        >
                          <option value="">Elegir…</option>
                          {cuentasOrdenadas.map((c) => (
                            <option key={c.id} value={String(c.id)}>
                              {c.nombre}
                            </option>
                          ))}
                        </select>
                      ) : (
                        r.cuentaNombre
                      )}
                    </td>
                    <td className="p-2 text-center pr-3">
                      <div className="flex items-center justify-center gap-1">
                        {editId === r.id ? (
                          <>
                            <button
                              type="button"
                              title="Guardar"
                              className="p-2 text-green-700 hover:bg-green-50 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
                              disabled={editando}
                              onClick={() => void guardarEdicion(r)}
                            >
                              <Check className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              title="Cancelar"
                              className="p-2 text-gray-600 hover:bg-gray-100 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
                              disabled={editando}
                              onClick={cancelarEditar}
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              title="Editar"
                              className="p-2 text-blue-600 hover:bg-blue-50 rounded-md"
                              onClick={() => startEditar(r)}
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              title="Eliminar"
                              className="p-2 text-red-600 hover:bg-red-50 rounded-md"
                              onClick={() => void borrar(r)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
