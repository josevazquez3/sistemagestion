"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { FinalizarLicencia } from "./FinalizarLicencia";
import { Search, FileText, Pencil, Trash2 } from "lucide-react";
import { TIPO_LICENCIA_LABEL, ESTADO_LICENCIA_LABEL, formatearFechaLicencia } from "@/lib/licencias.utils";
import type { TipoLicencia } from "@prisma/client";

type LegajoOption = { id: string; numeroLegajo: number; nombres: string; apellidos: string };

type LicenciaRow = {
  id: number;
  tipoLicencia: TipoLicencia;
  fechaInicio: string;
  fechaFin: string | null;
  estado: string;
  observaciones: string | null;
  legajo: { id: string; numeroLegajo: number; nombres: string; apellidos: string };
  certificados: { id: number; nombreArchivo: string; tipoArchivo: string; etapa: string; urlArchivo: string }[];
};

export interface HistorialLicenciasProps {
  legajoIdInicial?: string | null;
  /** Al hacer clic en Editar, se pasa el ID de la licencia para abrir el formulario en modo edición */
  onEditar?: (licenciaId: number) => void;
}

export function HistorialLicencias({ legajoIdInicial, onEditar }: HistorialLicenciasProps) {
  const { data: session } = useSession();
  const roles = (session?.user as { roles?: string[] })?.roles ?? [];
  const puedeEliminarFisico = roles.some((r) => ["SUPER_ADMIN", "ADMIN"].includes(String(r)));

  const [legajos, setLegajos] = useState<LegajoOption[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [legajoSeleccionado, setLegajoSeleccionado] = useState<LegajoOption | null>(null);
  const [mostrarSelector, setMostrarSelector] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number; width: number } | null>(null);

  const [licencias, setLicencias] = useState<LicenciaRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [filtroTipo, setFiltroTipo] = useState<string>("");
  const [filtroDesde, setFiltroDesde] = useState("");
  const [filtroHasta, setFiltroHasta] = useState("");

  const [finalizarId, setFinalizarId] = useState<number | null>(null);
  const [verCertificadosLicenciaId, setVerCertificadosLicenciaId] = useState<number | null>(null);
  const [eliminarModal, setEliminarModal] = useState<{ id: number; tipo: TipoLicencia } | null>(null);
  const [eliminandoFisico, setEliminandoFisico] = useState(false);

  const handleFocus = () => {
    if (typeof window !== "undefined" && inputRef.current) {
      const rect = inputRef.current.getBoundingClientRect();
      setDropdownPos({
        top: rect.bottom + window.scrollY + 4,
        left: rect.left + window.scrollX,
        width: rect.width,
      });
    }
    setMostrarSelector(true);
  };

  const cargarLegajos = useCallback(async () => {
    const res = await fetch("/api/legajos?estado=todos&perPage=500");
    if (!res.ok) return;
    const data = await res.json();

    const lista = Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : [];
    const options: LegajoOption[] = lista.map((l: any) => ({
      id: l.id,
      numeroLegajo: l.numeroLegajo,
      nombres: l.nombres,
      apellidos: l.apellidos,
    }));

    options.sort((a, b) => {
      const ap = a.apellidos.localeCompare(b.apellidos, "es", { sensitivity: "base" });
      if (ap !== 0) return ap;
      const nom = a.nombres.localeCompare(b.nombres, "es", { sensitivity: "base" });
      if (nom !== 0) return nom;
      return a.numeroLegajo - b.numeroLegajo;
    });
    setLegajos(options);
  }, []);

  useEffect(() => {
    cargarLegajos();
    if (legajoIdInicial && legajos.length) {
      const l = legajos.find((x) => x.id === legajoIdInicial);
      if (l) setLegajoSeleccionado(l);
    }
  }, [cargarLegajos, legajoIdInicial]);

  const cargarLicencias = useCallback(async () => {
    if (!legajoSeleccionado) {
      setLicencias([]);
      return;
    }
    setLoading(true);
    try {
      const params = new URLSearchParams({ legajoId: legajoSeleccionado.id });
      if (filtroTipo) params.set("tipo", filtroTipo);
      if (filtroDesde) params.set("desde", filtroDesde);
      if (filtroHasta) params.set("hasta", filtroHasta);
      const res = await fetch(`/api/licencias?${params}`);
      const data = await res.json();
      setLicencias(data.data || []);
    } catch {
      setLicencias([]);
    } finally {
      setLoading(false);
    }
  }, [legajoSeleccionado, filtroTipo, filtroDesde, filtroHasta]);

  useEffect(() => {
    cargarLicencias();
  }, [cargarLicencias]);

  const filtrados = legajos.filter((l) => {
    const q = busqueda.toLowerCase().trim();
    if (!q) return true;
    return (
      l.apellidos.toLowerCase().includes(q) ||
      l.nombres.toLowerCase().includes(q) ||
      String(l.numeroLegajo).includes(q)
    );
  });

  const MAX_RESULTADOS_DROPDOWN = 200;

  const handleEliminarFisico = useCallback(
    async (id: number) => {
      setEliminandoFisico(true);
      try {
        const res = await fetch(`/api/licencias/${id}`, { method: "DELETE" });
        if (res.ok) {
          setLicencias((prev) => prev.filter((l) => l.id !== id));
          setEliminarModal(null);
        } else {
          const data = await res.json().catch(() => null);
          alert(data?.error ?? "Error al eliminar la licencia");
        }
      } finally {
        setEliminandoFisico(false);
      }
    },
    []
  );

  return (
    <div className="space-y-4">
      <div>
        <Label>Empleado</Label>
        <div className="relative mt-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Buscar por nombre, apellido o legajo..."
            value={busqueda}
            onChange={(e) => { setBusqueda(e.target.value); handleFocus(); }}
            onFocus={handleFocus}
            className="h-9 w-full pl-9 pr-4 rounded-md border border-input text-sm"
          />
          {legajoSeleccionado && (
            <div className="mt-2 flex items-center gap-2">
              <span className="text-sm font-medium text-gray-800">
                {legajoSeleccionado.apellidos}, {legajoSeleccionado.nombres} (Leg. {legajoSeleccionado.numeroLegajo})
              </span>
              <Button type="button" variant="ghost" size="xs" onClick={() => { setLegajoSeleccionado(null); setBusqueda(""); }}>
                Cambiar
              </Button>
            </div>
          )}
          {mostrarSelector && !legajoSeleccionado && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setMostrarSelector(false)} />
              <div
                className="fixed z-[9999] rounded-lg border bg-white shadow-lg overflow-y-auto"
                style={{
                  top: dropdownPos?.top ?? 0,
                  left: dropdownPos?.left ?? 0,
                  width: dropdownPos?.width ?? "100%",
                  maxHeight: "300px",
                }}
              >
                {filtrados.length === 0 ? (
                  <p className="p-3 text-sm text-gray-500">Sin resultados</p>
                ) : (
                  filtrados.slice(0, MAX_RESULTADOS_DROPDOWN).map((l) => (
                    <button
                      key={l.id}
                      type="button"
                      onClick={() => {
                        setLegajoSeleccionado(l);
                        setBusqueda("");
                        setMostrarSelector(false);
                      }}
                      className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50"
                    >
                      {l.apellidos}, {l.nombres} — Leg. {l.numeroLegajo}
                    </button>
                  ))
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {legajoSeleccionado && (
        <>
          <div className="flex flex-wrap gap-4 items-end">
            <div>
              <Label className="text-xs">Tipo</Label>
              <select
                value={filtroTipo}
                onChange={(e) => setFiltroTipo(e.target.value)}
                className="mt-1 h-9 rounded-md border border-input bg-transparent px-3 text-sm"
              >
                <option value="">Todos</option>
                {Object.entries(TIPO_LICENCIA_LABEL).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <div>
              <Label className="text-xs">Desde</Label>
              <Input type="date" value={filtroDesde} onChange={(e) => setFiltroDesde(e.target.value)} className="mt-1 h-9 w-40" />
            </div>
            <div>
              <Label className="text-xs">Hasta</Label>
              <Input type="date" value={filtroHasta} onChange={(e) => setFiltroHasta(e.target.value)} className="mt-1 h-9 w-40" />
            </div>
          </div>

          {loading ? (
            <p className="text-sm text-gray-500">Cargando...</p>
          ) : (
            <div className="rounded-lg border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Fecha inicio</TableHead>
                    <TableHead>Fecha fin</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Certificados</TableHead>
                    <TableHead className="w-40">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {licencias.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-gray-500 py-8">
                        No hay licencias para este empleado.
                      </TableCell>
                    </TableRow>
                  ) : (
                    licencias.map((lic) => (
                      <TableRow key={lic.id}>
                        <TableCell>{TIPO_LICENCIA_LABEL[lic.tipoLicencia] ?? lic.tipoLicencia}</TableCell>
                        <TableCell>{formatearFechaLicencia(lic.fechaInicio)}</TableCell>
                        <TableCell>{lic.fechaFin ? formatearFechaLicencia(lic.fechaFin) : "—"}</TableCell>
                        <TableCell>
                          <span className={lic.estado === "ACTIVA" ? "text-amber-700 font-medium" : "text-gray-600"}>
                            {ESTADO_LICENCIA_LABEL[lic.estado] ?? lic.estado}
                          </span>
                        </TableCell>
                        <TableCell>
                          {lic.certificados.length > 0 ? (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-xs"
                              onClick={() => setVerCertificadosLicenciaId(lic.id === verCertificadosLicenciaId ? null : lic.id)}
                              title="Ver certificados"
                            >
                              <FileText className="h-4 w-4" />
                              <span className="ml-1 text-xs">{lic.certificados.length}</span>
                            </Button>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {onEditar && (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => onEditar(lic.id)}
                                title="Editar licencia"
                              >
                                <Pencil className="h-4 w-4 mr-1" />
                                Editar
                              </Button>
                            )}
                            {puedeEliminarFisico && (
                              <Button
                                type="button"
                                variant="destructive"
                                size="icon-sm"
                                onClick={() => setEliminarModal({ id: lic.id, tipo: lic.tipoLicencia })}
                                title="Eliminar permanentemente (irreversible)"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                            {lic.estado === "ACTIVA" && (
                              <Button type="button" variant="outline" size="sm" onClick={() => setFinalizarId(lic.id)}>
                                Finalizar
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}

          {verCertificadosLicenciaId !== null && (
            <CertificadosModal
              certificados={licencias.find((l) => l.id === verCertificadosLicenciaId)?.certificados ?? []}
              onClose={() => setVerCertificadosLicenciaId(null)}
            />
          )}

          {eliminarModal && (
            <Dialog open onOpenChange={() => !eliminandoFisico && setEliminarModal(null)}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Eliminar licencia</DialogTitle>
                  <DialogDescription>
                    ¿Eliminar permanentemente esta licencia de{" "}
                    {TIPO_LICENCIA_LABEL[eliminarModal.tipo] ?? eliminarModal.tipo}? Esta acción no se puede deshacer y
                    borrará también sus certificados asociados.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setEliminarModal(null)}
                    disabled={eliminandoFisico}
                  >
                    Cancelar
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => handleEliminarFisico(eliminarModal.id)}
                    disabled={eliminandoFisico}
                  >
                    {eliminandoFisico ? "Eliminando..." : "Eliminar"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </>
      )}

      {finalizarId !== null && (
        <FinalizarLicencia
          licenciaId={finalizarId}
          legajoNombre={legajoSeleccionado ? `${legajoSeleccionado.apellidos}, ${legajoSeleccionado.nombres}` : ""}
          open={true}
          onClose={() => setFinalizarId(null)}
          onSuccess={() => {
            setFinalizarId(null);
            cargarLicencias();
          }}
        />
      )}
    </div>
  );
}

function CertificadosModal({
  certificados,
  onClose,
}: {
  certificados: { id: number; nombreArchivo: string; tipoArchivo: string; urlArchivo: string }[];
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl p-6 max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-semibold text-gray-800 mb-3">Certificados de la licencia</h3>
        <ul className="space-y-2">
          {certificados.length === 0 ? (
            <li className="text-sm text-gray-500">No hay certificados.</li>
          ) : (
            certificados.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-2">
                <span className="text-sm truncate">{c.nombreArchivo}</span>
                <a
                  href={`/api/certificados/${c.id}/download`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-green-600 text-sm shrink-0"
                >
                  Ver / Descargar
                </a>
              </li>
            ))
          )}
        </ul>
        <Button variant="outline" className="mt-4" onClick={onClose}>Cerrar</Button>
      </div>
    </div>
  );
}
