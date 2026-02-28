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
} from "@/components/ui/dialog";
import { ObservacionModal } from "./ObservacionModal";
import {
  formatearFechaLicencia,
  diasTranscurridos,
  diasRestantes,
  TIPO_LICENCIA_LABEL,
} from "@/lib/licencias.utils";
import {
  exportarPDFTodos,
  exportarDOCXTodos,
  exportarPDFIndividual,
  exportarDOCXIndividual,
  type LicenciaNomina,
} from "@/lib/exportarLicencias";
import { Pencil, Trash2, FileText, FileDown, Loader2 } from "lucide-react";

const OBS_TRUNCATE = 60;

function observacionTexto(lic: LicenciaNomina): string {
  const obs = lic.observacionesNomina?.[0]?.texto?.trim();
  if (!obs) return "";
  return obs.length > OBS_TRUNCATE ? obs.slice(0, OBS_TRUNCATE) + "..." : obs;
}

function textoDiasRestantes(lic: LicenciaNomina): { texto: string; clase: string } {
  const fin = lic.fechaFin ? new Date(lic.fechaFin) : null;
  const rest = diasRestantes(fin);
  if (rest === null) return { texto: "—", clase: "text-gray-600" };
  if (rest < 0) return { texto: "VENCIDA", clase: "text-red-600 font-bold" };
  if (rest === 0) return { texto: "Vence hoy", clase: "text-amber-600 font-medium" };
  return { texto: String(rest), clase: "text-red-600 font-bold" };
}

export function NominaLicencias() {
  const [licencias, setLicencias] = useState<LicenciaNomina[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorFetch, setErrorFetch] = useState<string | null>(null);
  const [modalObservacion, setModalObservacion] = useState<{
    licenciaId: number;
    empleadoNombre: string;
    tipoLicencia: string;
  } | null>(null);
  const [eliminarObs, setEliminarObs] = useState<{
    licenciaId: number;
    observacionId: number;
  } | null>(null);
  const [eliminando, setEliminando] = useState(false);

  const cargar = useCallback(async () => {
    setLoading(true);
    setErrorFetch(null);
    try {
      const res = await fetch("/api/licencias/activas", {
        cache: "no-store",
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorFetch(data.error || `Error ${res.status}`);
        setLicencias([]);
        return;
      }
      const lista = Array.isArray(data.data) ? data.data : [];
      setLicencias(lista);
    } catch (e) {
      setErrorFetch(e instanceof Error ? e.message : "Error al cargar la nómina");
      setLicencias([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const eliminarObservacion = async () => {
    if (!eliminarObs) return;
    setEliminando(true);
    try {
      const res = await fetch(
        `/api/licencias/${eliminarObs.licenciaId}/observaciones/${eliminarObs.observacionId}`,
        { method: "DELETE" }
      );
      if (res.ok) {
        setEliminarObs(null);
        cargar();
      }
    } finally {
      setEliminando(false);
    }
  };

  return (
    <div className="w-full max-w-full overflow-hidden space-y-4">
      <div className="flex flex-wrap gap-2 items-center justify-between">
        <span className="text-sm text-gray-600">
          {licencias.length} empleado{licencias.length !== 1 ? "s" : ""} con licencia activa
        </span>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => exportarPDFTodos(licencias)}
            disabled={licencias.length === 0}
          >
            <FileText className="h-4 w-4 mr-1" />
            Exportar todo PDF
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => exportarDOCXTodos(licencias)}
            disabled={licencias.length === 0}
          >
            <FileDown className="h-4 w-4 mr-1" />
            Exportar todo DOCX
          </Button>
        </div>
      </div>

      {errorFetch && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {errorFetch}
        </div>
      )}
      {loading ? (
        <div className="flex items-center gap-2 text-gray-500 py-8">
          <Loader2 className="h-5 w-5 animate-spin" />
          Cargando nómina...
        </div>
      ) : (
        <div className="w-full overflow-x-hidden overflow-hidden rounded-lg border">
          <Table
            containerClassName="relative w-full overflow-x-hidden overflow-hidden"
            className="w-full table-fixed text-sm"
          >
            <colgroup>
              <col style={{ width: "6%" }} />
              <col style={{ width: "16%" }} />
              <col style={{ width: "12%" }} />
              <col style={{ width: "10%" }} />
              <col style={{ width: "10%" }} />
              <col style={{ width: "8%" }} />
              <col style={{ width: "10%" }} />
              <col style={{ width: "14%" }} />
              <col style={{ width: "8%" }} />
              <col style={{ width: "6%" }} />
            </colgroup>
            <TableHeader>
              <TableRow>
                <TableHead className="px-2 py-2">Legajo</TableHead>
                <TableHead className="px-2 py-2">Empleado</TableHead>
                <TableHead className="px-2 py-2">Tipo</TableHead>
                <TableHead className="px-2 py-2">F. Inicio</TableHead>
                <TableHead className="px-2 py-2">F. Fin</TableHead>
                <TableHead className="px-2 py-2 text-center">Días trans.</TableHead>
                <TableHead className="px-2 py-2 text-center">Días rest.</TableHead>
                <TableHead className="px-2 py-2">Obs.</TableHead>
                <TableHead className="px-2 py-2 text-center">Acciones</TableHead>
                <TableHead className="px-2 py-2 text-center">Export.</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {licencias.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center text-gray-500 px-2 py-2">
                    No hay empleados con licencia activa.
                  </TableCell>
                </TableRow>
              ) : (
                licencias.map((lic) => {
                  const inicio = new Date(lic.fechaInicio);
                  const trans = diasTranscurridos(inicio);
                  const { texto: restTexto, clase: restClase } = textoDiasRestantes(lic);
                  const obs = observacionTexto(lic);
                  const nombreCompleto = `${lic.legajo.apellidos}, ${lic.legajo.nombres}`;
                  const tipoLabel = TIPO_LICENCIA_LABEL[lic.tipoLicencia] ?? lic.tipoLicencia;
                  const tieneObs = (lic.observacionesNomina?.length ?? 0) > 0;
                  const ultimaObsId = lic.observacionesNomina?.[0]?.id;

                  return (
                    <TableRow key={lic.id}>
                      <TableCell className="overflow-hidden px-2 py-2">{lic.legajo.numeroLegajo}</TableCell>
                      <TableCell className="max-w-0 overflow-hidden px-2 py-2" title={nombreCompleto}>
                        <span className="block truncate">{nombreCompleto}</span>
                      </TableCell>
                      <TableCell className="max-w-0 overflow-hidden px-2 py-2" title={tipoLabel}>
                        <span className="block truncate">{tipoLabel}</span>
                      </TableCell>
                      <TableCell className="overflow-hidden px-2 py-2">{formatearFechaLicencia(inicio)}</TableCell>
                      <TableCell className="overflow-hidden px-2 py-2">
                        {lic.fechaFin
                          ? formatearFechaLicencia(new Date(lic.fechaFin))
                          : "—"}
                      </TableCell>
                      <TableCell className="px-2 py-2 text-center">{trans}</TableCell>
                      <TableCell className={`px-2 py-2 text-center ${restClase}`}>
                        {restTexto}
                      </TableCell>
                      <TableCell className="max-w-0 overflow-hidden px-2 py-2" title={lic.observacionesNomina?.[0]?.texto}>
                        <span className="block truncate text-sm">{obs || "—"}</span>
                      </TableCell>
                      <TableCell className="overflow-hidden px-2 py-2">
                        <div className="flex gap-0.5 justify-center">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            onClick={() =>
                              setModalObservacion({
                                licenciaId: lic.id,
                                empleadoNombre: nombreCompleto,
                                tipoLicencia: tipoLabel,
                              })
                            }
                            title="Agregar / Editar observación"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            onClick={() =>
                              ultimaObsId &&
                              setEliminarObs({ licenciaId: lic.id, observacionId: ultimaObsId })
                            }
                            disabled={!tieneObs}
                            title="Eliminar observación"
                          >
                            <Trash2 className="h-4 w-4 text-red-600" />
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell className="overflow-hidden px-2 py-2">
                        <div className="flex gap-0.5 justify-center">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => exportarPDFIndividual(lic)}
                            title="Exportar PDF individual"
                          >
                            <FileText className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => exportarDOCXIndividual(lic)}
                            title="Exportar DOCX individual"
                          >
                            <FileDown className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {modalObservacion !== null && (
        <ObservacionModal
          licenciaId={modalObservacion.licenciaId}
          empleadoNombre={modalObservacion.empleadoNombre}
          tipoLicencia={modalObservacion.tipoLicencia}
          open={true}
          onClose={() => setModalObservacion(null)}
          onSuccess={cargar}
        />
      )}

      <Dialog open={eliminarObs !== null} onOpenChange={(o) => !o && setEliminarObs(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Eliminar observación</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600">
            ¿Estás seguro de eliminar la observación?
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEliminarObs(null)} disabled={eliminando}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={eliminarObservacion} disabled={eliminando}>
              {eliminando ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
