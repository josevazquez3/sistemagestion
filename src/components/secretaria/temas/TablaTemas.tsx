"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { formatearFechaUTC } from "@/lib/utils/fecha";
import { ArrowDown, ArrowUp, FileText, Pencil, Trash2, ListChecks, RefreshCw } from "lucide-react";
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

  const swapNumeroOptimistic = async (tema: ApiTema, delta: -1 | 1) => {
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
  };

  const toggleEstado = async (t: ApiTema) => {
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
                  {visibles.map((t, idx) => {
                    const esFinalizado = t.estado === "FINALIZADO";
                    const esUsado =
                      t.estado === "PENDIENTE" && (t.usos?.length ?? 0) > 0;
                    const rowClass = esFinalizado
                      ? "bg-green-100 dark:bg-green-900/30"
                      : esUsado
                        ? "bg-yellow-100 dark:bg-yellow-900/30"
                        : "";
                    const finalizado = esFinalizado;
                    const fechaOD = latestIso(t.usos, "fechaOD");
                    const cantOD = countUsos(t.usos, "fechaOD");
                    const asig = asignacionTexto(t.asignaciones);
                    return (
                      <tr
                        key={t.id}
                        className={`border-b ${rowClass} ${rowClass === "" ? "hover:bg-muted/40" : ""}`}
                      >
                        <td className="p-2 pl-3 whitespace-nowrap">
                          <div className="flex items-center gap-1">
                            <span className="font-semibold">{t.numero}</span>
                            <div className="flex flex-col ml-1">
                              <button
                                type="button"
                                className="p-0.5 text-gray-500 hover:text-gray-800 disabled:opacity-30"
                                disabled={finalizado || idx === 0}
                                title="Subir"
                                onClick={() => void swapNumeroOptimistic(t, -1)}
                              >
                                <ArrowUp className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                className="p-0.5 text-gray-500 hover:text-gray-800 disabled:opacity-30"
                                disabled={finalizado || idx === visibles.length - 1}
                                title="Bajar"
                                onClick={() => void swapNumeroOptimistic(t, 1)}
                              >
                                <ArrowDown className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        </td>
                        <td className="p-2 whitespace-nowrap">{formatearFechaUTC(new Date(t.fecha))}</td>
                        <td className="p-2">{t.tema}</td>
                        <td className="p-2">{t.observacion ?? ""}</td>
                        <td className="p-2">{asig}</td>
                        <td className="p-2 pr-3 text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              disabled={finalizado}
                              onClick={() => {
                                setEditTema(t);
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
                                setTemaAsignar(t);
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
                                const res = await fetch(`/api/secretaria/temas/${t.id}`, { method: "DELETE" });
                                if (!res.ok) {
                                  const j = await res.json().catch(() => ({}));
                                  showMsg("error", j?.error || "No se pudo eliminar.");
                                  return;
                                }
                                setItems((prev) => prev.filter((x) => x.id !== t.id));
                                showMsg("ok", "Tema eliminado.");
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
                                finalizado
                                  ? "h-9 border-green-600 text-green-700 bg-white hover:bg-green-50"
                                  : "h-9"
                              }
                              onClick={() => void toggleEstado(t)}
                            >
                              {finalizado ? "Finalizado" : "Pendiente"}
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
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

