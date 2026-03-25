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
import { Checkbox } from "@/components/ui/checkbox";
import { formatearFechaUTC } from "@/lib/utils/fecha";
import type { MayorCuenta, MayorMovimiento, MayorRegla } from "@/types/tesoreria";
import { preseleccionarMovsPorReglas } from "@/lib/tesoreria/mayorModalPreseleccion";

type MovExtracto = {
  id: number;
  fecha: string;
  concepto: string;
  importePesos: number;
};

async function fetchExtractoNegativosRango(
  desdeYmd: string,
  hastaYmd: string
): Promise<MovExtracto[]> {
  const todos: MovExtracto[] = [];
  let page = 1;
  for (;;) {
    const res = await fetch(
      `/api/tesoreria/extracto-banco?desde=${encodeURIComponent(desdeYmd)}&hasta=${encodeURIComponent(hastaYmd)}&perPage=50&page=${page}`
    );
    const j = await res.json();
    if (!res.ok) throw new Error(j.error ?? "Error al cargar extracto");
    const batch = j.data ?? [];
    if (batch.length === 0) break;
    todos.push(...batch);
    const perPage = j.perPage ?? 50;
    const total = typeof j.total === "number" ? j.total : todos.length;
    if (todos.length >= total || batch.length < perPage) break;
    page += 1;
    if (page > 500) break;
  }
  return todos.filter((m) => Number(m.importePesos) < 0);
}

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fechaDesdeYmd: string;
  fechaHastaYmd: string;
  cuentas: MayorCuenta[];
  showMessage: (tipo: "ok" | "error", text: string) => void;
  onAsignado: () => void;
};

export function ModalMayorGastosExtracto({
  open,
  onOpenChange,
  fechaDesdeYmd,
  fechaHastaYmd,
  cuentas,
  showMessage,
  onAsignado,
}: Props) {
  const [cargando, setCargando] = useState(false);
  const [movs, setMovs] = useState<MovExtracto[]>([]);
  const [asignados, setAsignados] = useState<Map<number, string>>(new Map());
  const [seleccion, setSeleccion] = useState<Record<number, string>>({});
  const [esAuto, setEsAuto] = useState<Record<number, boolean>>({});
  const [guardandoId, setGuardandoId] = useState<number | null>(null);
  const [asignandoLote, setAsignandoLote] = useState(false);
  const [marcados, setMarcados] = useState<Set<number>>(() => new Set());
  const [eliminandoSel, setEliminandoSel] = useState(false);

  useEffect(() => {
    if (open) setMarcados(new Set());
  }, [open]);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const qMayor = `desde=${encodeURIComponent(fechaDesdeYmd)}&hasta=${encodeURIComponent(fechaHastaYmd)}`;
      const [lista, mayorRes, reglasRes] = await Promise.all([
        fetchExtractoNegativosRango(fechaDesdeYmd, fechaHastaYmd),
        fetch(`/api/tesoreria/mayor-movimientos?${qMayor}`).then((r) => r.json()),
        fetch("/api/tesoreria/mayor-reglas").then((r) => r.json()),
      ]);
      setMovs(lista);
      const mapa = new Map<number, string>();
      if (Array.isArray(mayorRes)) {
        for (const m of mayorRes as MayorMovimiento[]) {
          if (m.origen === "EXTRACTO" && m.origenId != null) {
            mapa.set(m.origenId, m.cuentaNombre);
          }
        }
      }
      setAsignados(mapa);
      const reglas: MayorRegla[] = reglasRes && Array.isArray(reglasRes) ? reglasRes : [];
      const inputs = reglas.map((r) => ({ palabra: r.palabra, cuentaId: r.cuentaId }));
      const { seleccion: sel, esAuto: auto } = preseleccionarMovsPorReglas(
        lista,
        new Set(mapa.keys()),
        inputs
      );
      setSeleccion(sel);
      setEsAuto(auto);
    } catch (e) {
      showMessage("error", e instanceof Error ? e.message : "Error al cargar");
      setMovs([]);
      setSeleccion({});
      setEsAuto({});
    } finally {
      setCargando(false);
    }
  }, [fechaDesdeYmd, fechaHastaYmd, showMessage]);

  useEffect(() => {
    if (open) void cargar();
  }, [open, cargar]);

  const asignar = async (mov: MovExtracto) => {
    const cuentaId = parseInt(seleccion[mov.id] ?? "", 10);
    if (!cuentaId || Number.isNaN(cuentaId)) {
      showMessage("error", "Elegí una cuenta.");
      return;
    }
    setGuardandoId(mov.id);
    try {
      const res = await fetch("/api/tesoreria/mayor-movimientos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cuentaId,
          fecha: mov.fecha,
          concepto: mov.concepto,
          importe: Number(mov.importePesos),
          origen: "EXTRACTO",
          origenId: mov.id,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showMessage("error", data?.error || "Error al asignar.");
        return;
      }
      const cuentaNombre =
        cuentas.find((c) => c.id === cuentaId)?.nombre ?? data.cuentaNombre ?? "";
      setAsignados((prev) => new Map(prev).set(mov.id, cuentaNombre));
      setEsAuto((ea) => {
        const n = { ...ea };
        delete n[mov.id];
        return n;
      });
      showMessage("ok", "Movimiento asignado.");
      onAsignado();
    } catch {
      showMessage("error", "Error de conexión.");
    } finally {
      setGuardandoId(null);
    }
  };

  const asignarLotePendientes = async () => {
    const pendientes = movs.filter(
      (m) => !asignados.has(m.id) && seleccion[m.id] && seleccion[m.id] !== ""
    );
    if (pendientes.length === 0) {
      showMessage("error", "No hay filas pendientes con cuenta elegida.");
      return;
    }
    setAsignandoLote(true);
    let ok = 0;
    let err = 0;
    try {
      for (const mov of pendientes) {
        const cuentaId = parseInt(seleccion[mov.id] ?? "", 10);
        if (!cuentaId || Number.isNaN(cuentaId)) continue;
        try {
          const res = await fetch("/api/tesoreria/mayor-movimientos", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              cuentaId,
              fecha: mov.fecha,
              concepto: mov.concepto,
              importe: Number(mov.importePesos),
              origen: "EXTRACTO",
              origenId: mov.id,
            }),
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) {
            err += 1;
            continue;
          }
          ok += 1;
          const cuentaNombre =
            cuentas.find((c) => c.id === cuentaId)?.nombre ?? data.cuentaNombre ?? "";
          setAsignados((prev) => new Map(prev).set(mov.id, cuentaNombre));
          setEsAuto((ea) => {
            const n = { ...ea };
            delete n[mov.id];
            return n;
          });
        } catch {
          err += 1;
        }
      }
      if (ok > 0) onAsignado();
      showMessage(
        ok > 0 ? "ok" : "error",
        err > 0
          ? `Asignadas ${ok} fila(s). ${err} error(es).`
          : `Asignadas ${ok} fila(s).`
      );
    } finally {
      setAsignandoLote(false);
    }
  };

  const todosMarcados = movs.length > 0 && movs.every((m) => marcados.has(m.id));
  const algunMarcado = movs.some((m) => marcados.has(m.id));

  const toggleMarcarTodos = (marcar: boolean) => {
    setMarcados(marcar ? new Set(movs.map((m) => m.id)) : new Set());
  };

  const toggleMarcadoFila = (id: number, on: boolean) => {
    setMarcados((prev) => {
      const n = new Set(prev);
      if (on) n.add(id);
      else n.delete(id);
      return n;
    });
  };

  const eliminarSeleccionados = async () => {
    const ids = [...marcados];
    if (ids.length === 0) return;
    if (
      !confirm(
        `¿Eliminar ${ids.length} movimiento(s) del extracto bancario? Si estaban asignados al mayor, también se quitarán de Mayores - Cuentas.`
      )
    ) {
      return;
    }
    setEliminandoSel(true);
    let ok = 0;
    let err = 0;
    try {
      for (const id of ids) {
        try {
          const res = await fetch(`/api/tesoreria/extracto-banco/${id}`, { method: "DELETE" });
          if (res.ok) ok += 1;
          else err += 1;
        } catch {
          err += 1;
        }
      }
      setMarcados(new Set());
      await cargar();
      if (ok > 0) onAsignado();
      showMessage(
        err > 0 ? (ok > 0 ? "ok" : "error") : "ok",
        err > 0
          ? `Eliminados ${ok} movimiento(s). ${err} no se pudieron eliminar.`
          : `Eliminados ${ok} movimiento(s) del extracto.`
      );
    } catch (e) {
      showMessage("error", e instanceof Error ? e.message : "Error al eliminar.");
    } finally {
      setEliminandoSel(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[min(72rem,98vw)] w-full max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Gastos Extracto Banco</DialogTitle>
          <p className="text-sm text-muted-foreground font-normal text-left">
            Las cuentas se preseleccionan según las <strong>reglas</strong> guardadas (palabras en el
            concepto). El badge <span className="text-green-800 bg-green-100 px-1 rounded text-xs">Auto</span>{" "}
            indica sugerencia automática; podés cambiarla antes de asignar.{" "}
            <strong>Asignar todas las pendientes</strong> envía cada fila con cuenta elegida.
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            <Button
              type="button"
              size="sm"
              disabled={
                cargando ||
                asignandoLote ||
                cuentas.length === 0 ||
                !movs.some((m) => !asignados.has(m.id) && seleccion[m.id])
              }
              onClick={() => void asignarLotePendientes()}
            >
              {asignandoLote ? "Asignando…" : "Asignar todas las pendientes"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="destructive"
              disabled={cargando || eliminandoSel || marcados.size === 0 || movs.length === 0}
              onClick={() => void eliminarSeleccionados()}
            >
              {eliminandoSel ? "Eliminando…" : `Eliminar seleccionados (${marcados.size})`}
            </Button>
          </div>
        </DialogHeader>
        <div className="flex-1 overflow-auto border rounded-md">
          {cargando ? (
            <p className="p-6 text-sm text-muted-foreground text-center">Cargando…</p>
          ) : movs.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground text-center">
              No hay movimientos negativos en el período.
            </p>
          ) : (
            <table className="w-full text-sm table-fixed">
              <thead className="sticky top-0 bg-muted/80 z-[1]">
                <tr className="border-b text-left">
                  <th className="w-10 p-2 pl-3">
                    <Checkbox
                      aria-label="Seleccionar todas las filas"
                      disabled={cargando || movs.length === 0 || eliminandoSel}
                      checked={
                        todosMarcados ? true : algunMarcado ? "indeterminate" : false
                      }
                      onCheckedChange={(v) => toggleMarcarTodos(v === true)}
                    />
                  </th>
                  <th className="p-2 w-[7.5rem]">Fecha</th>
                  <th className="p-2 w-[45%] min-w-[12rem]">Concepto</th>
                  <th className="p-2 w-[9rem] text-right">Importe</th>
                  <th className="p-2 min-w-[240px]">Asignar</th>
                </tr>
              </thead>
              <tbody>
                {movs.map((m) => {
                  const ya = asignados.get(m.id);
                  return (
                    <tr key={m.id} className="border-b hover:bg-muted/30 align-top">
                      <td className="p-2 pl-3 align-top">
                        <Checkbox
                          aria-label={`Seleccionar fila ${m.id}`}
                          disabled={cargando || eliminandoSel}
                          checked={marcados.has(m.id)}
                          onCheckedChange={(v) => toggleMarcadoFila(m.id, v === true)}
                        />
                      </td>
                      <td className="p-2 whitespace-nowrap align-top">
                        {formatearFechaUTC(new Date(m.fecha))}
                      </td>
                      <td className="p-2 align-top break-words whitespace-normal text-left leading-snug">
                        {m.concepto}
                      </td>
                      <td className="p-2 text-right whitespace-nowrap align-top">
                        {Number(m.importePesos).toLocaleString("es-AR", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </td>
                      <td className="p-2 align-top">
                        {ya ? (
                          <span className="text-green-700 font-medium">{ya}</span>
                        ) : (
                          <div className="flex flex-wrap items-center gap-2">
                            {esAuto[m.id] && (
                              <span className="text-xs font-medium text-green-800 bg-green-100 border border-green-200 px-1.5 py-0.5 rounded shrink-0">
                                Auto
                              </span>
                            )}
                            <select
                              className="border rounded-md px-2 py-1.5 text-sm min-w-[160px] flex-1 bg-background"
                              value={seleccion[m.id] ?? ""}
                              onChange={(e) => {
                                const v = e.target.value;
                                setSeleccion((s) => ({ ...s, [m.id]: v }));
                                setEsAuto((ea) => {
                                  const n = { ...ea };
                                  delete n[m.id];
                                  return n;
                                });
                              }}
                            >
                              <option value="">Cuenta…</option>
                              {cuentas.map((c) => (
                                <option key={c.id} value={String(c.id)}>
                                  {c.nombre}
                                </option>
                              ))}
                            </select>
                            <Button
                              type="button"
                              size="sm"
                              disabled={guardandoId === m.id || cuentas.length === 0}
                              onClick={() => void asignar(m)}
                            >
                              {guardandoId === m.id ? "…" : "Asignar"}
                            </Button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
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
