"use client";

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import { useSession } from "next-auth/react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { formatearFechaUTC } from "@/lib/utils/fecha";
import {
  ArrowDown,
  ArrowUp,
  FileText,
  Pencil,
  Trash2,
  ListChecks,
  RefreshCw,
  GripVertical,
} from "lucide-react";
import { ModalNuevoTema } from "./ModalNuevoTema";
import { ModalAsignacion, type TipoAsignacion } from "./ModalAsignacion";
import { exportarTemasDocx, type TemaExport } from "./ExportarTemas";
import { ModalTemaUsado } from "./ModalTemaUsado";

type ApiTemaAsignacion = { id: number; tipo: TipoAsignacion; otroTexto: string | null; createdAt: string };
type ApiTemaUso = { id: number; fechaOD: string | null; guiaMesa: string | null; createdAt: string; temaId: number };

type ApiTema = {
  id: number;
  numero: number;
  fecha: string;
  tema: string;
  observacion: string | null;
  estado: "PENDIENTE" | "FINALIZADO";
  asignaciones: ApiTemaAsignacion[];
  usos: ApiTemaUso[];
  usuario: { id: string; nombreCompleto: string };
  createdAt: string;
  updatedAt: string;
};

function asignacionTexto(asigs: ApiTemaAsignacion[]): string {
  if (!asigs || asigs.length === 0) return "";
  const label = (t: TipoAsignacion, otroTexto: string | null) => {
    if (t === "AL_ORDEN_DEL_DIA") return "Al Orden del Día";
    if (t === "AL_INFORME_GUIA") return "Al Informe Guía";
    if (t === "GIRAR_A_DISTRITOS") return "Girar a Distritos";
    if (t === "ARCHIVAR") return "Archivar";
    if (t === "OTROS") return otroTexto?.trim() ? `Otros: ${otroTexto.trim()}` : "Otros";
    return t;
  };
  return asigs.map((a) => label(a.tipo, a.otroTexto)).join(", ");
}

function latestIso(usos: ApiTemaUso[], key: "fechaOD" | "guiaMesa"): string | null {
  const list = usos
    .map((u) => u[key])
    .filter((x): x is string => typeof x === "string" && x.trim() !== "");
  if (list.length === 0) return null;
  return list.sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0] ?? null;
}

function countUsos(usos: ApiTemaUso[], key: "fechaOD" | "guiaMesa"): number {
  return usos.filter((u) => !!u[key]).length;
}

function PosicionInput({
  rank,
  n,
  disabled,
  onCommit,
  showMsg,
}: {
  rank: number;
  n: number;
  disabled: boolean;
  onCommit: (rank: number) => void;
  showMsg: (tipo: "ok" | "error", text: string) => void;
}) {
  const [local, setLocal] = useState<string | null>(null);
  const shown = local ?? String(rank);
  const commit = () => {
    const raw = (local ?? String(rank)).trim();
    setLocal(null);
    const v = parseInt(raw, 10);
    if (!Number.isFinite(v) || v < 1 || v > n) {
      showMsg("error", `Ingresá un número entre 1 y ${n}.`);
      return;
    }
    if (v !== rank) onCommit(v);
  };
  return (
    <Input
      className="h-8 w-14 px-1 text-center text-sm [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
      type="number"
      min={1}
      max={n}
      disabled={disabled}
      value={shown}
      onChange={(e) => setLocal(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
      }}
    />
  );
}

type FilaHandlers = {
  reordenando: boolean;
  onTemaEliminado: (id: number) => void;
  swapNumeroOptimistic: (tema: ApiTema, delta: -1 | 1) => void;
  onMoveToRank: (temaId: number, rank: number) => void;
  setEditTema: (t: ApiTema) => void;
  setModalNuevoOpen: (o: boolean) => void;
  setTemaAsignar: (t: ApiTema) => void;
  setModalAsignarOpen: (o: boolean) => void;
  showMsg: (tipo: "ok" | "error", text: string) => void;
  toggleEstado: (t: ApiTema) => void;
};

function SortableTemaFila({
  tema,
  idx,
  listaLen,
  nTotal,
  handlers,
}: {
  tema: ApiTema;
  idx: number;
  listaLen: number;
  nTotal: number;
  handlers: FilaHandlers;
}) {
  const finalizado = tema.estado === "FINALIZADO";
  const esUsado = tema.estado === "PENDIENTE" && (tema.usos?.length ?? 0) > 0;
  const rowClass = finalizado
    ? "bg-green-100 dark:bg-green-900/30"
    : esUsado
      ? "bg-yellow-100 dark:bg-yellow-900/30"
      : "";
  const asig = asignacionTexto(tema.asignaciones);

  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({
      id: tema.id,
      disabled: finalizado || handlers.reordenando,
    });

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.55 : undefined,
  };

  const {
    reordenando,
    onTemaEliminado,
    swapNumeroOptimistic,
    onMoveToRank,
    setEditTema,
    setModalNuevoOpen,
    setTemaAsignar,
    setModalAsignarOpen,
    showMsg,
    toggleEstado,
  } = handlers;

  return (
    <tr
      ref={setNodeRef}
      style={style}
      className={`border-b ${rowClass} ${rowClass === "" ? "hover:bg-muted/40" : ""}`}
    >
      <td className="p-2 pl-3 whitespace-nowrap">
        <div className="flex items-center gap-1">
          {!finalizado && (
            <button
              type="button"
              className="cursor-grab touch-none rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground active:cursor-grabbing disabled:pointer-events-none disabled:opacity-30"
              aria-label="Arrastrar para reordenar"
              disabled={reordenando}
              ref={setActivatorNodeRef}
              {...attributes}
              {...listeners}
            >
              <GripVertical className="h-4 w-4" />
            </button>
          )}
          {!finalizado ? (
            <PosicionInput
              key={`${tema.id}-${idx}`}
              rank={idx + 1}
              n={nTotal}
              disabled={reordenando}
              showMsg={showMsg}
              onCommit={(r) => {
                void onMoveToRank(tema.id, r);
              }}
            />
          ) : (
            <span className="font-semibold tabular-nums">{tema.numero}</span>
          )}
          <div className="flex flex-col ml-1">
            <button
              type="button"
              className="p-0.5 text-gray-500 hover:text-gray-800 disabled:opacity-30"
              disabled={finalizado || idx === 0}
              title="Subir"
              onClick={() => void swapNumeroOptimistic(tema, -1)}
            >
              <ArrowUp className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              className="p-0.5 text-gray-500 hover:text-gray-800 disabled:opacity-30"
              disabled={finalizado || idx === listaLen - 1}
              title="Bajar"
              onClick={() => void swapNumeroOptimistic(tema, 1)}
            >
              <ArrowDown className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </td>
      <td className="p-2 whitespace-nowrap">{formatearFechaUTC(new Date(tema.fecha))}</td>
      <td className="p-2">{tema.tema}</td>
      <td className="p-2">{tema.observacion ?? ""}</td>
      <td className="p-2">{asig}</td>
      <td className="p-2 pr-3 text-right">
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={finalizado}
            onClick={() => {
              setEditTema(tema);
              setModalNuevoOpen(true);
            }}
          >
            <Pencil className="w-4 h-4 mr-1" />
            Editar
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={finalizado}
            onClick={() => {
              setTemaAsignar(tema);
              setModalAsignarOpen(true);
            }}
          >
            <ListChecks className="w-4 h-4 mr-1" />
            Asignar
          </Button>
          <Button
            type="button"
            size="sm"
            variant="destructive"
            disabled={finalizado}
            onClick={async () => {
              if (!confirm("¿Eliminar tema?")) return;
              const res = await fetch(`/api/secretaria/temas/${tema.id}`, { method: "DELETE" });
              if (!res.ok) {
                const j = await res.json().catch(() => ({}));
                showMsg("error", j?.error || "No se pudo eliminar.");
                return;
              }
              showMsg("ok", "Tema eliminado.");
              onTemaEliminado(tema.id);
            }}
          >
            <Trash2 className="w-4 h-4 mr-1" />
            Borrar
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className={
              finalizado ? "h-9 border-green-600 text-green-700 bg-white hover:bg-green-50" : "h-9"
            }
            onClick={() => void toggleEstado(tema)}
          >
            {finalizado ? "Finalizado" : "Pendiente"}
          </Button>
        </div>
      </td>
    </tr>
  );
}

function TemaFilaFiltrada({
  tema,
  idx,
  listaLen,
  handlers,
}: {
  tema: ApiTema;
  idx: number;
  listaLen: number;
  handlers: FilaHandlers;
}) {
  const finalizado = tema.estado === "FINALIZADO";
  const esUsado = tema.estado === "PENDIENTE" && (tema.usos?.length ?? 0) > 0;
  const rowClass = finalizado
    ? "bg-green-100 dark:bg-green-900/30"
    : esUsado
      ? "bg-yellow-100 dark:bg-yellow-900/30"
      : "";
  const asig = asignacionTexto(tema.asignaciones);
  const {
    onTemaEliminado,
    swapNumeroOptimistic,
    setEditTema,
    setModalNuevoOpen,
    setTemaAsignar,
    setModalAsignarOpen,
    showMsg,
    toggleEstado,
  } = handlers;

  return (
    <tr className={`border-b ${rowClass} ${rowClass === "" ? "hover:bg-muted/40" : ""}`}>
      <td className="p-2 pl-3 whitespace-nowrap">
        <div className="flex items-center gap-1">
          <span className="font-semibold tabular-nums">{tema.numero}</span>
          <div className="flex flex-col ml-1">
            <button
              type="button"
              className="p-0.5 text-gray-500 hover:text-gray-800 disabled:opacity-30"
              disabled={finalizado || idx === 0}
              title="Subir"
              onClick={() => void swapNumeroOptimistic(tema, -1)}
            >
              <ArrowUp className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              className="p-0.5 text-gray-500 hover:text-gray-800 disabled:opacity-30"
              disabled={finalizado || idx === listaLen - 1}
              title="Bajar"
              onClick={() => void swapNumeroOptimistic(tema, 1)}
            >
              <ArrowDown className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </td>
      <td className="p-2 whitespace-nowrap">{formatearFechaUTC(new Date(tema.fecha))}</td>
      <td className="p-2">{tema.tema}</td>
      <td className="p-2">{tema.observacion ?? ""}</td>
      <td className="p-2">{asig}</td>
      <td className="p-2 pr-3 text-right">
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={finalizado}
            onClick={() => {
              setEditTema(tema);
              setModalNuevoOpen(true);
            }}
          >
            <Pencil className="w-4 h-4 mr-1" />
            Editar
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={finalizado}
            onClick={() => {
              setTemaAsignar(tema);
              setModalAsignarOpen(true);
            }}
          >
            <ListChecks className="w-4 h-4 mr-1" />
            Asignar
          </Button>
          <Button
            type="button"
            size="sm"
            variant="destructive"
            disabled={finalizado}
            onClick={async () => {
              if (!confirm("¿Eliminar tema?")) return;
              const res = await fetch(`/api/secretaria/temas/${tema.id}`, { method: "DELETE" });
              if (!res.ok) {
                const j = await res.json().catch(() => ({}));
                showMsg("error", j?.error || "No se pudo eliminar.");
                return;
              }
              showMsg("ok", "Tema eliminado.");
              onTemaEliminado(tema.id);
            }}
          >
            <Trash2 className="w-4 h-4 mr-1" />
            Borrar
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className={
              finalizado ? "h-9 border-green-600 text-green-700 bg-white hover:bg-green-50" : "h-9"
            }
            onClick={() => void toggleEstado(tema)}
          >
            {finalizado ? "Finalizado" : "Pendiente"}
          </Button>
        </div>
      </td>
    </tr>
  );
}

export function TablaTemas() {
  const { data: session } = useSession();
  const userName = session?.user?.name ?? "Usuario";

  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<ApiTema[]>([]);
  const [q, setQ] = useState("");
  const [mensaje, setMensaje] = useState<{ tipo: "ok" | "error"; text: string } | null>(null);

  const [modalNuevoOpen, setModalNuevoOpen] = useState(false);
  const [editTema, setEditTema] = useState<ApiTema | null>(null);

  const [modalAsignarOpen, setModalAsignarOpen] = useState(false);
  const [temaAsignar, setTemaAsignar] = useState<ApiTema | null>(null);

  const [modalTemaUsadoOpen, setModalTemaUsadoOpen] = useState(false);

  const showMsg = useCallback((tipo: "ok" | "error", text: string) => setMensaje({ tipo, text }), []);

  useEffect(() => {
    if (!mensaje) return;
    const t = setTimeout(() => setMensaje(null), 4000);
    return () => clearTimeout(t);
  }, [mensaje]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/secretaria/temas");
      const data = await res.json().catch(() => []);
      if (!res.ok) {
        showMsg("error", data?.error || "Error al cargar temas.");
        setItems([]);
        return;
      }
      setItems(Array.isArray(data) ? (data as ApiTema[]) : []);
    } catch {
      setItems([]);
      showMsg("error", "Error de conexión.");
    } finally {
      setLoading(false);
    }
  }, [showMsg]);

  useEffect(() => {
    void load();
  }, [load]);

  const visibles = useMemo(() => {
    const txt = q.trim().toLowerCase();
    if (!txt) return items.slice().sort((a, b) => a.numero - b.numero);
    return items
      .filter((t) => (t.tema ?? "").toLowerCase().includes(txt) || (t.observacion ?? "").toLowerCase().includes(txt))
      .sort((a, b) => a.numero - b.numero);
  }, [items, q]);

  const exportar = async () => {
    const temas: TemaExport[] = visibles.map((t) => ({
      numero: t.numero,
      fechaIso: t.fecha,
      tema: t.tema,
      observacion: t.observacion,
      fechaODIso: latestIso(t.usos, "fechaOD"),
      cantOD: countUsos(t.usos, "fechaOD"),
      asignacionTexto: asignacionTexto(t.asignaciones),
      estado: t.estado,
    }));
    await exportarTemasDocx(temas);
    showMsg("ok", "DOCX exportado.");
  };

  const swapNumeroOptimistic = useCallback(
    async (tema: ApiTema, delta: -1 | 1) => {
      const targetNumero = tema.numero + delta;
      const other = items.find((x) => x.numero === targetNumero);
      if (!other) return;

      setItems((prev) =>
        prev.map((x) =>
          x.id === tema.id ? { ...x, numero: targetNumero } : x.id === other.id ? { ...x, numero: tema.numero } : x
        )
      );

      try {
        const res = await fetch(`/api/secretaria/temas/${tema.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ numero: targetNumero }),
        });
        const j = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(j?.error || "No se pudo reordenar.");
        showMsg("ok", "Orden actualizado.");
        await load();
      } catch (e) {
        showMsg("error", e instanceof Error ? e.message : "Error al reordenar.");
        await load();
      }
    },
    [items, load, showMsg]
  );

  const [reordenando, setReordenando] = useState(false);
  const sinFiltro = q.trim() === "";

  const ordenados = useMemo(() => [...items].sort((a, b) => a.numero - b.numero), [items]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const aplicarOrdenDesdeIds = useCallback(
    async (orderedIds: number[]) => {
      const n = orderedIds.length;
      if (n === 0 || n !== items.length) return;
      setReordenando(true);
      try {
        let snapshot = [...items].sort((a, b) => a.numero - b.numero);
        for (let pos = 0; pos < n; pos++) {
          const wantId = orderedIds[pos]!;
          const rank = pos + 1;
          const holder = snapshot.find((x) => x.numero === rank);
          if (!holder || holder.id === wantId) continue;
          const res = await fetch(`/api/secretaria/temas/${wantId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ numero: rank }),
          });
          const j = await res.json().catch(() => ({}));
          if (!res.ok) {
            throw new Error(typeof j?.error === "string" ? j.error : "No se pudo reordenar.");
          }
          const oldNum = snapshot.find((x) => x.id === wantId)!.numero;
          snapshot = snapshot.map((x) => {
            if (x.id === wantId) return { ...x, numero: rank };
            if (x.id === holder.id) return { ...x, numero: oldNum };
            return x;
          });
        }
        showMsg("ok", "Orden actualizado.");
        await load();
      } catch (e) {
        showMsg("error", e instanceof Error ? e.message : "Error al reordenar.");
        await load();
      } finally {
        setReordenando(false);
      }
    },
    [items, load, showMsg]
  );

  const onMoveToRank = useCallback(
    async (temaId: number, targetRank: number) => {
      const sorted = [...items].sort((a, b) => a.numero - b.numero);
      const n = sorted.length;
      if (targetRank < 1 || targetRank > n) {
        showMsg("error", `Ingresá un número entre 1 y ${n}.`);
        return;
      }
      const oldIdx = sorted.findIndex((x) => x.id === temaId);
      if (oldIdx < 0) return;
      const newIdx = targetRank - 1;
      if (oldIdx === newIdx) return;
      const newOrder = arrayMove(
        sorted.map((x) => x.id),
        oldIdx,
        newIdx
      );
      await aplicarOrdenDesdeIds(newOrder);
    },
    [items, aplicarOrdenDesdeIds, showMsg]
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      const sorted = [...items].sort((a, b) => a.numero - b.numero);
      const oldIndex = sorted.findIndex((x) => x.id === active.id);
      const newIndex = sorted.findIndex((x) => x.id === over.id);
      if (oldIndex < 0 || newIndex < 0) return;
      const newOrder = arrayMove(
        sorted.map((x) => x.id),
        oldIndex,
        newIndex
      );
      void aplicarOrdenDesdeIds(newOrder);
    },
    [items, aplicarOrdenDesdeIds]
  );

  const toggleEstado = useCallback(async (t: ApiTema) => {
    const next = t.estado === "FINALIZADO" ? "PENDIENTE" : "FINALIZADO";
    try {
      const res = await fetch(`/api/secretaria/temas/${t.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estado: next }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        showMsg("error", j?.error || "No se pudo cambiar el estado.");
        return;
      }
      setItems((prev) => prev.map((x) => (x.id === t.id ? { ...x, estado: next } : x)));
      showMsg("ok", next === "FINALIZADO" ? "Tema finalizado." : "Tema vuelto a pendiente.");
    } catch {
      showMsg("error", "Error de conexión.");
    }
  }, [showMsg]);

  const onTemaEliminado = useCallback((id: number) => {
    setItems((prev) => prev.filter((x) => x.id !== id));
  }, []);

  const filaHandlers = useMemo<FilaHandlers>(
    () => ({
      reordenando,
      onTemaEliminado,
      swapNumeroOptimistic,
      onMoveToRank,
      setEditTema,
      setModalNuevoOpen,
      setTemaAsignar,
      setModalAsignarOpen,
      showMsg,
      toggleEstado,
    }),
    [
      reordenando,
      onTemaEliminado,
      swapNumeroOptimistic,
      onMoveToRank,
      showMsg,
      toggleEstado,
    ]
  );

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
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="relative w-full max-w-md">
              <Input placeholder="Buscar…" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={() => setModalTemaUsadoOpen(true)}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Tema Usado
              </Button>
              <Button
                type="button"
                className="bg-[#4CAF50] hover:bg-[#388E3C] text-white"
                onClick={() => {
                  setEditTema(null);
                  setModalNuevoOpen(true);
                }}
              >
                Nuevo Tema
              </Button>
              <Button type="button" variant="outline" onClick={() => void exportar()}>
                <FileText className="w-4 h-4 mr-2" />
                Exportar
              </Button>
            </div>
          </div>

          {loading ? (
            <p className="text-muted-foreground py-8 text-center">Cargando…</p>
          ) : visibles.length === 0 ? (
            <p className="text-muted-foreground py-8 text-center">No hay temas.</p>
          ) : (
            <>
              {q.trim() !== "" && items.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  Con búsqueda activa no podés arrastrar filas ni usar la posición numérica; usá las flechas.
                </p>
              )}
              {sinFiltro ? (
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                  <div className="border rounded-lg overflow-x-auto">
                    <table className="w-full text-sm min-w-[1300px]">
                      <thead>
                        <tr className="border-b text-left text-gray-600">
                          <th className="p-2 pl-3 w-36">#</th>
                          <th className="p-2 w-28">Fecha</th>
                          <th className="p-2">Tema</th>
                          <th className="p-2">Observación</th>
                          <th className="p-2">Asignación</th>
                          <th className="p-2 w-44 text-right pr-3">Acciones</th>
                        </tr>
                      </thead>
                      <SortableContext
                        items={ordenados.map((t) => t.id)}
                        strategy={verticalListSortingStrategy}
                      >
                        <tbody>
                          {ordenados.map((t, idx) => (
                            <SortableTemaFila
                              key={t.id}
                              tema={t}
                              idx={idx}
                              listaLen={ordenados.length}
                              nTotal={ordenados.length}
                              handlers={filaHandlers}
                            />
                          ))}
                        </tbody>
                      </SortableContext>
                    </table>
                  </div>
                </DndContext>
              ) : (
                <div className="border rounded-lg overflow-x-auto">
                  <table className="w-full text-sm min-w-[1300px]">
                    <thead>
                      <tr className="border-b text-left text-gray-600">
                        <th className="p-2 pl-3 w-20">#</th>
                        <th className="p-2 w-28">Fecha</th>
                        <th className="p-2">Tema</th>
                        <th className="p-2">Observación</th>
                        <th className="p-2">Asignación</th>
                        <th className="p-2 w-44 text-right pr-3">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibles.map((t, idx) => (
                        <TemaFilaFiltrada
                          key={t.id}
                          tema={t}
                          idx={idx}
                          listaLen={visibles.length}
                          handlers={filaHandlers}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <ModalNuevoTema
        open={modalNuevoOpen}
        onOpenChange={(open) => {
          setModalNuevoOpen(open);
          if (!open) setEditTema(null);
        }}
        userName={userName}
        refetch={load}
        onEditarExito={() => showMsg("ok", "Tema actualizado correctamente")}
        onError={(msg) => showMsg("error", msg)}
        initial={
          editTema
            ? {
                fecha: editTema.fecha ? formatearFechaUTC(new Date(editTema.fecha)) : "",
                tema: editTema.tema,
                observacion: editTema.observacion,
                temaId: editTema.id,
                usos: editTema.usos,
              }
            : null
        }
        onGuardar={async (data) => {
          try {
            const res = await fetch("/api/secretaria/temas", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(data),
            });
            const j = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(j?.error || "No se pudo crear.");
            setItems((prev) => [...prev, j as ApiTema]);
            showMsg("ok", "Tema creado.");
          } catch (e) {
            showMsg("error", e instanceof Error ? e.message : "Error al guardar.");
            throw e;
          }
        }}
      />

      <ModalAsignacion
        open={modalAsignarOpen}
        onOpenChange={(o) => {
          setModalAsignarOpen(o);
          if (!o) setTemaAsignar(null);
        }}
        temaTexto={temaAsignar?.tema ?? ""}
        initialAsignaciones={
          temaAsignar?.asignaciones.map((a) => ({ tipo: a.tipo, otroTexto: a.otroTexto })) ?? []
        }
        onGuardar={async (asignaciones) => {
          if (!temaAsignar) return;
          const res = await fetch(`/api/secretaria/temas/${temaAsignar.id}/asignaciones`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ asignaciones }),
          });
          const j = await res.json().catch(() => ({}));
          if (!res.ok) {
            showMsg("error", j?.error || "No se pudo guardar la asignación.");
            throw new Error(String(j?.error ?? "Error"));
          }
          setItems((prev) => prev.map((x) => (x.id === temaAsignar.id ? (j as ApiTema) : x)));
          showMsg("ok", "Asignación guardada.");
        }}
      />

      <ModalTemaUsado
        open={modalTemaUsadoOpen}
        onOpenChange={setModalTemaUsadoOpen}
        reload={load}
        onBatchDone={({ ok, fail, firstError }) => {
          if (fail === 0) {
            showMsg("ok", `${ok} tema(s) duplicado(s) correctamente`);
          } else if (ok === 0) {
            showMsg("error", firstError ?? "No se pudo duplicar ningún tema.");
          } else {
            showMsg(
              "ok",
              `${ok} de ${ok + fail} duplicados correctamente. Fallaron ${fail}${firstError ? `: ${firstError}` : ""}.`
            );
          }
        }}
      />
    </div>
  );
}

