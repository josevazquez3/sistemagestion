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
import { Check, Plus, Trash2, FileSpreadsheet } from "lucide-react";
import type { CuitDistrito, IngresoDistrito } from "@/types/ingresos-distritos";
import {
  extraerCuitDelConcepto,
  normalizarCuitParaMatch,
} from "@/lib/tesoreria/extraerCuitConcepto";

const API = "/api/tesoreria/ingresos-distritos/cuit-distritos";

type FilaLocal = {
  clientKey: string;
  id?: number;
  distrito: string;
  cuit: string;
};

function nuevaClaveCliente() {
  return `nuevo-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/** CUITs ya presentes en filas (guardadas o pendientes), por dígitos */
function cuitsNormalizadosEnFilas(filas: FilaLocal[]): Set<string> {
  const s = new Set<string>();
  for (const f of filas) {
    const k = normalizarCuitParaMatch(f.cuit);
    if (k) s.add(k);
  }
  return s;
}

type ModalCuitDistritosProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  showMessage: (tipo: "ok" | "error", text: string) => void;
  /** Registros de la planilla principal (mismo conjunto que la tabla visible) */
  registros: IngresoDistrito[];
};

export function ModalCuitDistritos({
  open,
  onOpenChange,
  showMessage,
  registros,
}: ModalCuitDistritosProps) {
  const [filas, setFilas] = useState<FilaLocal[]>([]);
  const [cargando, setCargando] = useState(false);
  const [guardandoKey, setGuardandoKey] = useState<string | null>(null);
  const [guardandoTodos, setGuardandoTodos] = useState(false);

  const cargarLista = useCallback(async () => {
    setCargando(true);
    try {
      const res = await fetch(API);
      const data = await res.json();
      if (!res.ok) {
        showMessage("error", data?.error || "Error al cargar CUIT distritos.");
        setFilas([]);
        return;
      }
      const lista = Array.isArray(data) ? (data as CuitDistrito[]) : [];
      setFilas(
        lista.map((r) => ({
          clientKey: `id-${r.id}`,
          id: r.id,
          distrito: r.distrito,
          cuit: r.cuit,
        }))
      );
    } catch {
      showMessage("error", "Error de conexión.");
      setFilas([]);
    } finally {
      setCargando(false);
    }
  }, [showMessage]);

  useEffect(() => {
    if (open) void cargarLista();
  }, [open, cargarLista]);

  const agregarFila = () => {
    setFilas((f) => [
      ...f,
      { clientKey: nuevaClaveCliente(), distrito: "", cuit: "" },
    ]);
  };

  const importarDesdePlanilla = () => {
    const existentes = cuitsNormalizadosEnFilas(filas);
    const yaVistos = new Set<string>(existentes);
    const nuevasFilas: FilaLocal[] = [];

    for (const reg of registros) {
      const cuitExt = extraerCuitDelConcepto(reg.concepto);
      const distritoT = reg.distrito?.trim() ?? "";
      if (!cuitExt || !distritoT) continue;
      const norm = normalizarCuitParaMatch(cuitExt);
      if (!norm) continue;
      if (yaVistos.has(norm)) continue;
      yaVistos.add(norm);
      nuevasFilas.push({
        clientKey: nuevaClaveCliente(),
        distrito: distritoT,
        cuit: cuitExt.trim(),
      });
    }

    if (nuevasFilas.length === 0) {
      showMessage("ok", "No hay datos nuevos para importar.");
      return;
    }

    setFilas((f) => [...f, ...nuevasFilas]);
    showMessage("ok", `Se agregaron ${nuevasFilas.length} fila(s) pendiente(s). Revisá y guardá.`);
  };

  const pendientesSinId = filas.filter(
    (r) => r.id == null && r.distrito.trim() && r.cuit.trim()
  );

  const guardarTodosPendientes = async () => {
    if (pendientesSinId.length === 0) {
      showMessage("ok", "No hay filas pendientes para guardar.");
      return;
    }
    setGuardandoTodos(true);
    let ok = 0;
    let errores = 0;
    try {
      for (const row of pendientesSinId) {
        const distrito = row.distrito.trim();
        const cuit = row.cuit.trim();
        try {
          const res = await fetch(API, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ distrito, cuit }),
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) {
            errores++;
            continue;
          }
          ok++;
          setFilas((rows) =>
            rows.map((r) =>
              r.clientKey === row.clientKey
                ? {
                    clientKey: `id-${data.id}`,
                    id: data.id,
                    distrito: data.distrito ?? distrito,
                    cuit: data.cuit ?? cuit,
                  }
                : r
            )
          );
        } catch {
          errores++;
        }
      }
      if (errores === 0) {
        showMessage("ok", `Se guardaron ${ok} registro(s).`);
      } else {
        showMessage(
          "error",
          `Guardados: ${ok}. No se pudieron guardar: ${errores}.`
        );
      }
    } finally {
      setGuardandoTodos(false);
    }
  };

  const actualizarFila = (clientKey: string, patch: Partial<FilaLocal>) => {
    setFilas((rows) =>
      rows.map((r) => (r.clientKey === clientKey ? { ...r, ...patch } : r))
    );
  };

  const eliminarFila = async (row: FilaLocal) => {
    if (!row.id) {
      setFilas((f) => f.filter((x) => x.clientKey !== row.clientKey));
      return;
    }
    if (!confirm("¿Eliminar este CUIT / distrito?")) return;
    try {
      const res = await fetch(`${API}/${row.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        showMessage("error", data?.error || "Error al eliminar.");
        return;
      }
      showMessage("ok", "Eliminado.");
      setFilas((f) => f.filter((x) => x.clientKey !== row.clientKey));
    } catch {
      showMessage("error", "Error de conexión.");
    }
  };

  const guardarFila = async (row: FilaLocal) => {
    const distrito = row.distrito.trim();
    const cuit = row.cuit.trim();
    if (!distrito || !cuit) {
      showMessage("error", "Completá distrito y CUIT.");
      return;
    }
    setGuardandoKey(row.clientKey);
    try {
      if (row.id != null) {
        const res = await fetch(`${API}/${row.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ distrito, cuit }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          showMessage("error", data?.error || "Error al guardar.");
          return;
        }
        showMessage("ok", "Actualizado.");
        actualizarFila(row.clientKey, {
          distrito: data.distrito ?? distrito,
          cuit: data.cuit ?? cuit,
        });
      } else {
        const res = await fetch(API, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ distrito, cuit }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          showMessage("error", data?.error || "Error al crear.");
          return;
        }
        showMessage("ok", "Guardado.");
        setFilas((rows) =>
          rows.map((r) =>
            r.clientKey === row.clientKey
              ? {
                  clientKey: `id-${data.id}`,
                  id: data.id,
                  distrito: data.distrito ?? distrito,
                  cuit: data.cuit ?? cuit,
                }
              : r
          )
        );
      }
    } catch {
      showMessage("error", "Error de conexión.");
    } finally {
      setGuardandoKey(null);
    }
  };

  const bloquearAccionesFila = guardandoTodos || guardandoKey !== null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Cuit Distritos</DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto space-y-3 pr-1 min-h-[200px]">
          {cargando ? (
            <p className="text-sm text-muted-foreground py-6 text-center">Cargando…</p>
          ) : filas.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">
              No hay registros. Usá &quot;Importar desde planilla&quot; o &quot;+ Agregar Dto.&quot;
            </p>
          ) : (
            filas.map((row) => (
              <div
                key={row.clientKey}
                className="flex flex-wrap items-end gap-2 border rounded-lg p-3 bg-muted/30"
              >
                <div className="flex-1 min-w-[100px]">
                  <Label className="text-xs">Distrito</Label>
                  <Input
                    value={row.distrito}
                    onChange={(e) =>
                      actualizarFila(row.clientKey, { distrito: e.target.value })
                    }
                    placeholder="I, II, X…"
                    disabled={guardandoTodos}
                  />
                </div>
                <div className="flex-[2] min-w-[160px]">
                  <Label className="text-xs">CUIT</Label>
                  <Input
                    value={row.cuit}
                    onChange={(e) =>
                      actualizarFila(row.clientKey, { cuit: e.target.value })
                    }
                    placeholder="XX-XXXXXXXX-X"
                    disabled={guardandoTodos}
                  />
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    className="text-green-700 border-green-200 hover:bg-green-50"
                    title="Guardar"
                    disabled={bloquearAccionesFila || guardandoKey === row.clientKey}
                    onClick={() => void guardarFila(row)}
                  >
                    <Check className="w-4 h-4" />
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    className="text-red-600 border-red-200 hover:bg-red-50"
                    title="Eliminar"
                    disabled={bloquearAccionesFila}
                    onClick={() => void eliminarFila(row)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={importarDesdePlanilla}
          disabled={cargando || guardandoTodos || registros.length === 0}
        >
          <FileSpreadsheet className="w-4 h-4 mr-2" />
          Importar desde planilla
        </Button>
        <Button
          type="button"
          variant="secondary"
          className="w-full"
          onClick={agregarFila}
          disabled={cargando || guardandoTodos}
        >
          <Plus className="w-4 h-4 mr-2" />
          Agregar Dto.
        </Button>
        {pendientesSinId.length > 0 && (
          <Button
            type="button"
            className="w-full bg-green-700 hover:bg-green-800"
            onClick={() => void guardarTodosPendientes()}
            disabled={cargando || guardandoTodos || bloquearAccionesFila}
          >
            {guardandoTodos
              ? "Guardando…"
              : `Guardar todos (${pendientesSinId.length} pendiente(s))`}
          </Button>
        )}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
