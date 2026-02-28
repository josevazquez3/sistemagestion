"use client";

import { useState, useEffect, useCallback, useRef, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CalendarioLicencia } from "./CalendarioLicencia";
import { SubirCertificados, type ArchivoPreview } from "./SubirCertificados";
import { Search, Loader2, Pencil, Save, X, Trash2, FileText } from "lucide-react";
import { TIPO_LICENCIA_LABEL } from "@/lib/licencias.utils";
import type { TipoLicencia } from "@prisma/client";

type LegajoOption = {
  id: string;
  numeroLegajo: number;
  nombres: string;
  apellidos: string;
};

type CertificadoExistente = { id: number; nombreArchivo: string; urlArchivo: string };

export interface FormularioLicenciaProps {
  /** Se llama al guardar o al terminar; opcionalmente con mensaje de éxito (ej. "Cambios guardados") */
  onSuccess?: (message?: string) => void;
  onCancel?: () => void;
  /** Si viene del historial, abrir en modo edición con esta licencia */
  licenciaIdEditar?: number | null;
}

export function FormularioLicencia({ onSuccess, onCancel, licenciaIdEditar }: FormularioLicenciaProps) {
  const [legajos, setLegajos] = useState<LegajoOption[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [legajoSeleccionado, setLegajoSeleccionado] = useState<LegajoOption | null>(null);
  const [mostrarSelector, setMostrarSelector] = useState(false);
  const inputLegajoRef = useRef<HTMLDivElement>(null);
  const [dropdownPosition, setDropdownPosition] = useState<{ top: number; left: number; width: number } | null>(null);

  const [fechaInicio, setFechaInicio] = useState("");
  const [fechaFin, setFechaFin] = useState("");
  const [tipoLicencia, setTipoLicencia] = useState<TipoLicencia>("ENFERMEDAD");
  const [observaciones, setObservaciones] = useState("");
  const [diasMarcados, setDiasMarcados] = useState<string[]>([]);
  /** Mes a mostrar en el calendario (navegación al cambiar fechas desde los inputs) */
  const [mesActivoCalendario, setMesActivoCalendario] = useState<{ año: number; mes: number } | null>(null);
  const [archivos, setArchivos] = useState<ArchivoPreview[]>([]);

  const [guardando, setGuardando] = useState(false);
  const [subiendoCert, setSubiendoCert] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [licenciaCreadaId, setLicenciaCreadaId] = useState<number | null>(null);

  /** Modo edición: ID de la licencia que se está editando (desde "Editar" o desde historial) */
  const [licenciaEnEdicion, setLicenciaEnEdicion] = useState<number | null>(null);
  const [certificadosExistentes, setCertificadosExistentes] = useState<CertificadoExistente[]>([]);
  const [cargandoLicencia, setCargandoLicencia] = useState(false);
  const datosOriginalesEdicion = useRef<{ fechaFin: string; observaciones: string; certificados: CertificadoExistente[] } | null>(null);

  const cargarLegajos = useCallback(async () => {
    const res = await fetch("/api/legajos?estado=activo&perPage=500");
    if (!res.ok) return;
    const data = await res.json();
    setLegajos(data.data || []);
  }, []);

  useEffect(() => {
    cargarLegajos();
  }, [cargarLegajos]);

  /** Abrir en modo edición: desde prop licenciaIdEditar (historial) */
  useEffect(() => {
    if (licenciaIdEditar == null) return;
    setCargandoLicencia(true);
    setError(null);
    fetch(`/api/licencias/${licenciaIdEditar}`)
      .then((r) => r.json())
      .then((lic) => {
        if (!lic.id) throw new Error("Licencia no encontrada");
        const leg = lic.legajo;
        setLegajoSeleccionado({
          id: leg.id,
          numeroLegajo: leg.numeroLegajo,
          nombres: leg.nombres,
          apellidos: leg.apellidos,
        });
        setBusqueda("");
        setTipoLicencia(lic.tipoLicencia);
        setFechaInicio(lic.fechaInicio ? lic.fechaInicio.slice(0, 10) : "");
        setFechaFin(lic.fechaFin ? lic.fechaFin.slice(0, 10) : "");
        setObservaciones(lic.observaciones ?? "");
        setDiasMarcados(Array.isArray(lic.diasMarcados) ? lic.diasMarcados : []);
        setCertificadosExistentes((lic.certificados ?? []).map((c: { id: number; nombreArchivo: string; urlArchivo: string }) => ({ id: c.id, nombreArchivo: c.nombreArchivo, urlArchivo: c.urlArchivo })));
        datosOriginalesEdicion.current = {
          fechaFin: lic.fechaFin ? lic.fechaFin.slice(0, 10) : "",
          observaciones: lic.observaciones ?? "",
          certificados: (lic.certificados ?? []).map((c: { id: number; nombreArchivo: string; urlArchivo: string }) => ({ id: c.id, nombreArchivo: c.nombreArchivo, urlArchivo: c.urlArchivo })),
        };
        setLicenciaEnEdicion(licenciaIdEditar);
        setArchivos([]);
      })
      .catch(() => setError("Error al cargar la licencia"))
      .finally(() => setCargandoLicencia(false));
  }, [licenciaIdEditar]);

  useLayoutEffect(() => {
    if (mostrarSelector && !legajoSeleccionado && typeof document !== "undefined") {
      const el = inputLegajoRef.current;
      if (el) {
        const rect = el.getBoundingClientRect();
        setDropdownPosition({ top: rect.bottom + 4, left: rect.left, width: rect.width });
      } else {
        setDropdownPosition(null);
      }
    } else {
      setDropdownPosition(null);
    }
  }, [mostrarSelector, legajoSeleccionado]);

  const filtrados = legajos.filter((l) => {
    const q = busqueda.toLowerCase().trim();
    if (!q) return true;
    return (
      l.apellidos.toLowerCase().includes(q) ||
      l.nombres.toLowerCase().includes(q) ||
      String(l.numeroLegajo).includes(q)
    );
  });

  const entrarEnEdicion = useCallback(async () => {
    const id = licenciaCreadaId;
    if (!id) return;
    setCargandoLicencia(true);
    try {
      const r = await fetch(`/api/licencias/${id}`);
      const lic = await r.json();
      if (!lic.id) return;
      setCertificadosExistentes((lic.certificados ?? []).map((c: { id: number; nombreArchivo: string; urlArchivo: string }) => ({ id: c.id, nombreArchivo: c.nombreArchivo, urlArchivo: c.urlArchivo })));
      datosOriginalesEdicion.current = {
        fechaFin: fechaFin,
        observaciones: observaciones,
        certificados: (lic.certificados ?? []).map((c: { id: number; nombreArchivo: string; urlArchivo: string }) => ({ id: c.id, nombreArchivo: c.nombreArchivo, urlArchivo: c.urlArchivo })),
      };
      setLicenciaEnEdicion(id);
      setArchivos([]);
    } finally {
      setCargandoLicencia(false);
    }
  }, [licenciaCreadaId, fechaFin, observaciones]);

  const cancelarEdicion = useCallback(() => {
    if (datosOriginalesEdicion.current) {
      setFechaFin(datosOriginalesEdicion.current.fechaFin);
      setObservaciones(datosOriginalesEdicion.current.observaciones);
      setCertificadosExistentes([...datosOriginalesEdicion.current.certificados]);
    }
    setLicenciaEnEdicion(null);
    datosOriginalesEdicion.current = null;
    setArchivos([]);
    if (licenciaIdEditar != null) onCancel?.();
  }, [licenciaIdEditar, onCancel]);

  const eliminarCertificado = useCallback(async (certId: number) => {
    const res = await fetch(`/api/certificados/${certId}`, { method: "DELETE" });
    if (res.ok) setCertificadosExistentes((prev) => prev.filter((c) => c.id !== certId));
  }, []);

  const guardarCambiosEdicion = async () => {
    const id = licenciaEnEdicion;
    if (!id) return;
    setError(null);
    setGuardando(true);
    try {
      const res = await fetch(`/api/licencias/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fechaFin: fechaFin || null,
          observaciones: observaciones || null,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Error al guardar");
      }
      const sinError = archivos.filter((a) => !a.error);
      if (sinError.length > 0) {
        setSubiendoCert(true);
        const formData = new FormData();
        formData.set("etapa", "INICIO");
        sinError.forEach((a) => formData.append("files", a.file));
        const up = await fetch(`/api/licencias/${id}/certificados`, { method: "POST", body: formData });
        setSubiendoCert(false);
        if (!up.ok) {
          const err = await up.json();
          throw new Error(err.error || "Error al subir certificados");
        }
      }
      datosOriginalesEdicion.current = null;
      setLicenciaEnEdicion(null);
      setCertificadosExistentes([]);
      setArchivos([]);
      if (licenciaCreadaId === id) setLicenciaCreadaId(null);
      onSuccess?.("Cambios guardados");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al guardar");
    } finally {
      setGuardando(false);
    }
  };

  const guardar = async () => {
    if (!legajoSeleccionado) {
      setError("Seleccioná un legajo");
      return;
    }
    if (!fechaInicio) {
      setError("Ingresá la fecha de inicio");
      return;
    }
    setError(null);
    setGuardando(true);
    try {
      const res = await fetch("/api/licencias", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          legajoId: legajoSeleccionado.id,
          tipoLicencia,
          fechaInicio,
          fechaFin: fechaFin || null,
          observaciones: observaciones || null,
          diasMarcados,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al crear licencia");
      setLicenciaCreadaId(data.id);

      if (archivos.length > 0) {
        setSubiendoCert(true);
        const formData = new FormData();
        formData.set("etapa", "INICIO");
        archivos.filter((a) => !a.error).forEach((a) => formData.append("files", a.file));
        const up = await fetch(`/api/licencias/${data.id}/certificados`, {
          method: "POST",
          body: formData,
        });
        setSubiendoCert(false);
        if (!up.ok) {
          const err = await up.json();
          setError("Licencia creada pero falló subir certificados: " + (err.error || ""));
        } else {
          onSuccess?.();
        }
      } else {
        onSuccess?.();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al guardar");
    } finally {
      setGuardando(false);
    }
  };

  const subirCertificadosRestantes = async () => {
    if (!licenciaCreadaId || archivos.length === 0) return;
    const sinError = archivos.filter((a) => !a.error);
    if (sinError.length === 0) {
      onSuccess?.();
      return;
    }
    setSubiendoCert(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.set("etapa", "INICIO");
      sinError.forEach((a) => formData.append("files", a.file));
      const up = await fetch(`/api/licencias/${licenciaCreadaId}/certificados`, {
        method: "POST",
        body: formData,
      });
      if (!up.ok) {
        const err = await up.json();
        setError(err.error || "Error al subir certificados");
      } else {
        onSuccess?.();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setSubiendoCert(false);
    }
  };

  const listoYVolver = () => {
    setLicenciaCreadaId(null);
    setLicenciaEnEdicion(null);
    setError(null);
    setArchivos([]);
    setCertificadosExistentes([]);
    datosOriginalesEdicion.current = null;
    onSuccess?.();
  };

  const esModoEdicion = licenciaEnEdicion != null;
  const esVistaRecienCreada = licenciaCreadaId != null && !esModoEdicion;

  return (
    <div className="space-y-6">
      {/* Selector de legajo (oculto en modo edición) */}
      {!esModoEdicion && (
        <div>
          <Label>Legajo del empleado</Label>
          <div ref={inputLegajoRef} className="relative mt-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por nombre, apellido o número de legajo..."
              value={busqueda}
              onChange={(e) => {
                setBusqueda(e.target.value);
                setMostrarSelector(true);
              }}
              onFocus={() => setMostrarSelector(true)}
              className="h-9 w-full pl-9 pr-4 rounded-md border border-input text-sm"
            />
            {legajoSeleccionado && (
              <div className="mt-2 flex items-center gap-2">
                <span className="text-sm font-medium text-gray-800">
                  {legajoSeleccionado.apellidos}, {legajoSeleccionado.nombres} (Leg. {legajoSeleccionado.numeroLegajo})
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  onClick={() => {
                    setLegajoSeleccionado(null);
                    setBusqueda("");
                  }}
                >
                  Cambiar
                </Button>
              </div>
            )}
            {mostrarSelector && !legajoSeleccionado && dropdownPosition && typeof document !== "undefined" && createPortal(
              <div
                className="fixed z-50 max-h-60 overflow-y-auto overflow-x-hidden rounded-lg border border-gray-200 bg-white shadow-lg"
                style={{
                  top: dropdownPosition.top,
                  left: dropdownPosition.left,
                  width: dropdownPosition.width,
                }}
              >
                {filtrados.length === 0 ? (
                  <p className="p-3 text-sm text-gray-500">Sin resultados</p>
                ) : (
                  filtrados.slice(0, 50).map((l) => (
                    <button
                      key={l.id}
                      type="button"
                      onClick={() => {
                        setLegajoSeleccionado(l);
                        setBusqueda("");
                        setMostrarSelector(false);
                      }}
                      className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50"
                    >
                      {l.apellidos}, {l.nombres} — Leg. {l.numeroLegajo}
                    </button>
                  ))
                )}
              </div>,
              document.body
            )}
            {mostrarSelector && !legajoSeleccionado && (
              <div className="fixed inset-0 z-40" onClick={() => setMostrarSelector(false)} aria-hidden="true" />
            )}
          </div>
        </div>
      )}

      {legajoSeleccionado && (
        <>
          {cargandoLicencia ? (
            <div className="flex items-center gap-2 text-gray-500 py-4">
              <Loader2 className="h-5 w-5 animate-spin" />
              Cargando licencia...
            </div>
          ) : (
            <>
              {esModoEdicion && (
                <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-3 text-sm text-amber-800">
                  Modo edición: podés modificar fecha de finalización, observaciones y certificados.
                </div>
              )}

              {/* Legajo en modo edición: solo lectura */}
              {esModoEdicion && legajoSeleccionado && (
                <div>
                  <Label>Empleado</Label>
                  <p className="mt-1 text-sm text-gray-700">
                    {legajoSeleccionado.apellidos}, {legajoSeleccionado.nombres} (Leg. {legajoSeleccionado.numeroLegajo})
                  </p>
                </div>
              )}

              <CalendarioLicencia
                diasMarcados={diasMarcados}
                onChange={esModoEdicion ? () => {} : setDiasMarcados}
                onFechaInicioChange={esModoEdicion ? undefined : setFechaInicio}
                onFechaFinChange={esModoEdicion ? undefined : setFechaFin}
                mesActivo={mesActivoCalendario ?? undefined}
                disabled={esModoEdicion}
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="fechaInicio">Fecha de inicio</Label>
                  <Input
                    id="fechaInicio"
                    type="date"
                    value={fechaInicio}
                    onChange={(e) => {
                      if (esModoEdicion) return;
                      const value = e.target.value;
                      setFechaInicio(value);
                      if (!value) return;
                      setDiasMarcados((prev) => {
                        const next = prev.filter((d) => d >= value);
                        if (!next.includes(value)) next.push(value);
                        return next.sort();
                      });
                      setMesActivoCalendario({
                        año: parseInt(value.slice(0, 4), 10),
                        mes: parseInt(value.slice(5, 7), 10),
                      });
                    }}
                    className="mt-1"
                    readOnly={esModoEdicion}
                    disabled={esModoEdicion}
                  />
                </div>
                <div>
                  <Label htmlFor="fechaFin">Fecha de finalización</Label>
                  <Input
                    id="fechaFin"
                    type="date"
                    value={fechaFin}
                    onChange={(e) => {
                      const value = e.target.value;
                      setFechaFin(value);
                      if (esModoEdicion || !value) return;
                      setDiasMarcados((prev) => {
                        const next = prev.filter((d) => d <= value && (!fechaInicio || d >= fechaInicio));
                        if (!next.includes(value)) next.push(value);
                        return next.sort();
                      });
                      setMesActivoCalendario({
                        año: parseInt(value.slice(0, 4), 10),
                        mes: parseInt(value.slice(5, 7), 10),
                      });
                    }}
                    className="mt-1"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="tipoLicencia">Tipo de licencia</Label>
                <select
                  id="tipoLicencia"
                  value={tipoLicencia}
                  onChange={(e) => !esModoEdicion && setTipoLicencia(e.target.value as TipoLicencia)}
                  className="mt-1 h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm disabled:opacity-70 disabled:cursor-not-allowed"
                  disabled={esModoEdicion}
                >
                  {Object.entries(TIPO_LICENCIA_LABEL).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>

              <div>
                <Label htmlFor="observaciones">Observaciones (opcional)</Label>
                <textarea
                  id="observaciones"
                  value={observaciones}
                  onChange={(e) => setObservaciones(e.target.value)}
                  rows={2}
                  className="mt-1 w-full rounded-md border border-input px-3 py-2 text-sm"
                  placeholder="Notas adicionales..."
                />
              </div>

              <div>
                <Label>Certificados (PDF o JPG)</Label>
                {esModoEdicion && certificadosExistentes.length > 0 && (
                  <div className="mt-2 space-y-2">
                    <p className="text-xs text-gray-500">Certificados ya adjuntados:</p>
                    <ul className="space-y-1">
                      {certificadosExistentes.map((c) => (
                        <li
                          key={c.id}
                          className="flex items-center justify-between gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
                        >
                          <span className="flex items-center gap-2 truncate">
                            <FileText className="h-4 w-4 text-gray-400 shrink-0" />
                            {c.nombreArchivo}
                          </span>
                          <div className="flex items-center gap-1 shrink-0">
                            <a
                              href={c.urlArchivo}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-green-600 hover:underline text-xs"
                            >
                              Ver
                            </a>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-xs"
                              onClick={() => eliminarCertificado(c.id)}
                              title="Eliminar certificado"
                            >
                              <Trash2 className="h-4 w-4 text-red-600" />
                            </Button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {!esModoEdicion && (
                  <p className="text-xs text-gray-500 mb-2">Opcional. Podés adjuntarlos ahora o después.</p>
                )}
                {esModoEdicion && <p className="text-xs text-gray-500 mb-2">Agregar nuevos certificados (se suman a los existentes):</p>}
                <SubirCertificados
                  value={archivos}
                  onChange={setArchivos}
                  disabled={!!licenciaCreadaId && !esModoEdicion && archivos.every((a) => a.error)}
                />
              </div>

              {error && (
                <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">{error}</p>
              )}

              <div className="flex flex-wrap gap-2">
                {!licenciaCreadaId && !esModoEdicion && (
                  <>
                    <Button onClick={guardar} disabled={guardando || subiendoCert}>
                      {guardando ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                      Guardar licencia
                    </Button>
                    {onCancel && (
                      <Button type="button" variant="outline" onClick={onCancel} disabled={guardando}>
                        Cancelar
                      </Button>
                    )}
                  </>
                )}
                {esVistaRecienCreada && (
                  <>
                    {archivos.some((a) => !a.error) && (
                      <Button onClick={subirCertificadosRestantes} disabled={subiendoCert}>
                        {subiendoCert ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                        Subir certificados
                      </Button>
                    )}
                    <Button type="button" variant="outline" onClick={entrarEnEdicion} disabled={cargandoLicencia}>
                      <Pencil className="h-4 w-4 mr-1" />
                      Editar
                    </Button>
                    <Button onClick={listoYVolver}>Listo, volver</Button>
                  </>
                )}
                {esModoEdicion && (
                  <>
                    <Button onClick={guardarCambiosEdicion} disabled={guardando || subiendoCert}>
                      {(guardando || subiendoCert) ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
                      Guardar cambios
                    </Button>
                    <Button type="button" variant="outline" onClick={cancelarEdicion} disabled={guardando}>
                      <X className="h-4 w-4 mr-1" />
                      Cancelar
                    </Button>
                  </>
                )}
              </div>
            </>
          )}
        </>
      )}

      {licenciaIdEditar != null && !legajoSeleccionado && !cargandoLicencia && (
        <p className="text-sm text-gray-500">No se pudo cargar la licencia.</p>
      )}
    </div>
  );
}
