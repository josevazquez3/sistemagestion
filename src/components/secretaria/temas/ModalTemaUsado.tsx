"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { formatearFechaUTC } from "@/lib/utils/fecha";
import { Loader2, RefreshCw } from "lucide-react";
type ApiTema = {
  id: number;
  numero: number;
  fecha: string;
  tema: string;
  estado: "PENDIENTE" | "FINALIZADO";
};

function truncarTema(s: string, max: number) {
  const t = (s ?? "").trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max)}...`;
}

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Resumen por lote (Promise.allSettled): ok + fail pueden coexistir. */
  onBatchDone: (r: { ok: number; fail: number; firstError?: string }) => void;
  reload: () => Promise<void>;
};

export function ModalTemaUsado({ open, onOpenChange, onBatchDone, reload }: Props) {
  const [cargandoLista, setCargandoLista] = useState(false);
  const [temas, setTemas] = useState<ApiTema[]>([]);
  const [marcados, setMarcados] = useState<Set<number>>(new Set());
  const [activando, setActivando] = useState(false);

  const cargar = useCallback(async () => {
    setCargandoLista(true);
    try {
      const res = await fetch("/api/secretaria/temas");
      const data = await res.json().catch(() => []);
      if (!res.ok) {
        setTemas([]);
        return;
      }
      setTemas(Array.isArray(data) ? (data as ApiTema[]) : []);
    } catch {
      setTemas([]);
    } finally {
      setCargandoLista(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    setMarcados(new Set());
    void cargar();
  }, [open, cargar]);

  const toggle = (id: number, on: boolean) => {
    setMarcados((prev) => {
      const n = new Set(prev);
      if (on) n.add(id);
      else n.delete(id);
      return n;
    });
  };

  const activar = async () => {
    const ids = [...marcados];
    if (ids.length === 0) return;

    setActivando(true);
    try {
      const results = await Promise.allSettled(
        ids.map(async (id) => {
          const res = await fetch(`/api/secretaria/temas/${id}/duplicar`, {
            method: "POST",
          });
          const j = await res.json().catch(() => ({}));
          if (!res.ok) {
            throw new Error(typeof j?.error === "string" ? j.error : "Error al duplicar tema.");
          }
        })
      );

      let ok = 0;
      let fail = 0;
      let firstError: string | undefined;
      for (const r of results) {
        if (r.status === "fulfilled") {
          ok += 1;
        } else {
          fail += 1;
          if (!firstError) {
            const reason = r.reason;
            firstError = reason instanceof Error ? reason.message : String(reason);
          }
        }
      }

      if (ok > 0) {
        await reload();
      }

      onBatchDone({ ok, fail, firstError });
      if (ok > 0) {
        onOpenChange(false);
        setMarcados(new Set());
      }
    } finally {
      setActivando(false);
    }
  };

  const ordenados = [...temas].sort((a, b) => a.numero - b.numero);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[88vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5" />
            Tema usado
          </DialogTitle>
          <p className="text-sm text-muted-foreground font-normal text-left">
            Seleccioná uno o más temas para generar una copia nueva con fecha de hoy; los originales no se
            modifican.
          </p>
        </DialogHeader>

        <div className="flex-1 overflow-auto min-h-[200px] border rounded-md p-2 space-y-1">
          {cargandoLista ? (
            <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground text-sm">
              <Loader2 className="h-5 w-5 animate-spin" />
              Cargando temas…
            </div>
          ) : ordenados.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No hay temas.</p>
          ) : (
            ordenados.map((t) => {
              const fechaTxt = formatearFechaUTC(new Date(t.fecha));
              const preview = truncarTema(t.tema, 60);
              const fin = t.estado === "FINALIZADO";
              return (
                <label
                  key={t.id}
                  className="flex items-start gap-3 rounded-md border border-transparent px-2 py-2 hover:bg-muted/50 cursor-pointer"
                >
                  <Checkbox
                    checked={marcados.has(t.id)}
                    onCheckedChange={(v) => toggle(t.id, v === true)}
                    className="mt-0.5"
                  />
                  <span className="text-sm flex-1 leading-snug">
                    <span className="font-medium">#{t.numero}</span>
                    <span className="text-muted-foreground"> — {fechaTxt} — </span>
                    <span className="break-words">&quot;{preview}&quot;</span>
                    <span className="ml-2 inline-block align-middle">
                      <span
                        className={
                          fin
                            ? "text-xs rounded-full px-2 py-0.5 bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200"
                            : "text-xs rounded-full px-2 py-0.5 bg-amber-100 text-amber-900 dark:bg-amber-900/30 dark:text-amber-100"
                        }
                      >
                        {fin ? "FINALIZADO" : "PENDIENTE"}
                      </span>
                    </span>
                  </span>
                </label>
              );
            })
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" disabled={activando} onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            type="button"
            disabled={marcados.size === 0 || activando || cargandoLista}
            onClick={() => void activar()}
            className="bg-[#4CAF50] hover:bg-[#388E3C] text-white"
          >
            {activando ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Duplicando…
              </>
            ) : (
              "Activar"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
