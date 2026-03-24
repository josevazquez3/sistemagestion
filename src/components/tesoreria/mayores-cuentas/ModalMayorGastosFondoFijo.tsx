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
import { formatearFechaUTC, fechaSeguraParaPrisma } from "@/lib/utils/fecha";
import type { MayorCuenta, MayorMovimiento, MayorRegla } from "@/types/tesoreria";
import {
  fechaIsoSoloDiaEnRangoUtc,
  mesesCubrenRangoUtc,
} from "@/lib/tesoreria/periodoMayor";
import { preseleccionarMovsPorReglas } from "@/lib/tesoreria/mayorModalPreseleccion";

type MovFondo = {
  id: number;
  fecha: string;
  concepto: string;
  importePesos: number;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fechaDesdeYmd: string;
  fechaHastaYmd: string;
  cuentas: MayorCuenta[];
  showMessage: (tipo: "ok" | "error", text: string) => void;
  onAsignado: () => void;
};

export function ModalMayorGastosFondoFijo({
  open,
  onOpenChange,
  fechaDesdeYmd,
  fechaHastaYmd,
  cuentas,
  showMessage,
  onAsignado,
}: Props) {
  const [cargando, setCargando] = useState(false);
  const [movs, setMovs] = useState<MovFondo[]>([]);
  const [asignados, setAsignados] = useState<Map<number, string>>(new Map());
  const [seleccion, setSeleccion] = useState<Record<number, string>>({});
  const [esAuto, setEsAuto] = useState<Record<number, boolean>>({});
  const [guardandoId, setGuardandoId] = useState<number | null>(null);
  const [asignandoLote, setAsignandoLote] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const inicio = fechaSeguraParaPrisma(fechaDesdeYmd);
      const fin = fechaSeguraParaPrisma(fechaHastaYmd);
      const meses = mesesCubrenRangoUtc(inicio, fin);

      const qMayor = `desde=${encodeURIComponent(fechaDesdeYmd)}&hasta=${encodeURIComponent(fechaHastaYmd)}`;
      const [respuestasFf, mayorRes, reglasRes] = await Promise.all([
        Promise.all(
          meses.map(({ mes, anio }) =>
            fetch(`/api/tesoreria/fondo-fijo?mes=${mes}&anio=${anio}`).then((r) =>
              r.json().then((j) => ({ ok: r.ok, j }))
            )
          )
        ),
        fetch(`/api/tesoreria/mayor-movimientos?${qMayor}`).then((r) => r.json()),
        fetch("/api/tesoreria/mayor-reglas").then((r) => r.json()),
      ]);

      const todosFf: MovFondo[] = [];
      for (const { ok, j } of respuestasFf) {
        if (!ok) {
          showMessage("error", j?.error || "Error Fondo Fijo");
          setMovs([]);
          setSeleccion({});
          setEsAuto({});
          setCargando(false);
          return;
        }
        const arr = Array.isArray(j) ? j : [];
        todosFf.push(...(arr as MovFondo[]));
      }

      const negativos = todosFf.filter(
        (m) =>
          Number(m.importePesos) < 0 &&
          fechaIsoSoloDiaEnRangoUtc(m.fecha, inicio, fin)
      );

      const mapa = new Map<number, string>();
      if (Array.isArray(mayorRes)) {
        for (const m of mayorRes as MayorMovimiento[]) {
          if (m.origen === "FONDO_FIJO" && m.origenId != null) {
            mapa.set(m.origenId, m.cuentaNombre);
          }
        }
      }

      setMovs(negativos);
      setAsignados(mapa);
      const reglas: MayorRegla[] = reglasRes && Array.isArray(reglasRes) ? reglasRes : [];
      const inputs = reglas.map((r) => ({ palabra: r.palabra, cuentaId: r.cuentaId }));
      const { seleccion: sel, esAuto: auto } = preseleccionarMovsPorReglas(
        negativos,
        new Set(mapa.keys()),
        inputs
      );
      setSeleccion(sel);
      setEsAuto(auto);
    } catch {
      showMessage("error", "Error de conexión.");
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

  const asignar = async (mov: MovFondo) => {
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
          origen: "FONDO_FIJO",
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
              origen: "FONDO_FIJO",
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[min(72rem,98vw)] w-full max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Gastos Fondo Fijo</DialogTitle>
          <p className="text-sm text-muted-foreground font-normal text-left">
            Preselección por reglas de palabras clave (igual que extracto).{" "}
            <span className="text-green-800 bg-green-100 px-1 rounded text-xs">Auto</span> = sugerencia;
            podés cambiar la cuenta antes de confirmar.
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
