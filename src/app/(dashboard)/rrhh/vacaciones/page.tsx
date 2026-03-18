"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CalendarioVacaciones } from "@/components/vacaciones/CalendarioVacaciones";
import { ContadorDias } from "@/components/vacaciones/ContadorDias";
import { SolicitudModal } from "@/components/vacaciones/SolicitudModal";
import { TablaSolicitudes, type SolicitudTabla } from "@/components/vacaciones/TablaSolicitudes";
import { ModalEditarSolicitud } from "@/components/vacaciones/ModalEditarSolicitud";
import { ModalConfirmarBaja } from "@/components/vacaciones/ModalConfirmarBaja";
import { calcularDiasVacaciones, formatearFecha } from "@/lib/vacaciones.utils";
import {
  getMiConfiguracionVacaciones,
  getSolicitudesVacaciones,
  crearSolicitudVacaciones,
  editarSolicitudVacaciones,
  darDeBajaSolicitud,
} from "@/app/actions/vacaciones";
import { Loader2, Calendar } from "lucide-react";
import type { RangoFechas } from "@/components/vacaciones/CalendarioVacaciones";
import { isSuperAdmin } from "@/lib/auth.utils";
import { emitNovedadesLiquidadoresRefresh } from "@/lib/rrhh-dashboard-events";

export default function VacacionesPage() {
  const { data: session } = useSession();
  const rolesSession = (session?.user as { roles?: unknown })?.roles ?? [];
  const [rolesFromMe, setRolesFromMe] = useState<string[] | null>(null);
  const esSuperAdmin = isSuperAdmin(rolesSession) || isSuperAdmin(rolesFromMe ?? []);

  useEffect(() => {
    if (!session?.user) return;
    fetch("/api/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.roles) setRolesFromMe(data.roles);
      })
      .catch(() => {});
  }, [session?.user]);

  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState<{
    legajoId: string;
    diasDisponibles: number;
    diasUtilizados: number;
    diasRestantes: number;
    secretarioGeneral: string;
  } | null>(null);
  const [solicitudes, setSolicitudes] = useState<SolicitudTabla[]>([]);
  const [rango, setRango] = useState<RangoFechas>([null, null]);
  const [guardando, setGuardando] = useState(false);
  const [solicitudModal, setSolicitudModal] = useState<{
    open: boolean;
    diasSolicitados: number;
    diasRestantes: number;
    solicitudId: number;
  } | null>(null);
  const [editarModal, setEditarModal] = useState<{
    open: boolean;
    solicitud: SolicitudTabla;
  } | null>(null);
  const [bajaModal, setBajaModal] = useState<SolicitudTabla | null>(null);
  const [bajaLoading, setBajaLoading] = useState(false);
  const [eliminarFisicoModal, setEliminarFisicoModal] = useState<SolicitudTabla | null>(null);
  const [eliminarFisicoLoading, setEliminarFisicoLoading] = useState(false);

  const [estadoConfig, setEstadoConfig] = useState<"sin_legajo" | "sin_config" | "ok">("sin_legajo");

  const cargarDatos = useCallback(async () => {
    const res = await getMiConfiguracionVacaciones();
    if (!res.success) {
      setConfig(null);
      setEstadoConfig("sin_legajo");
      setLoading(false);
      return;
    }
    if (res.estado === "sin_legajo") {
      setConfig(null);
      setEstadoConfig("sin_legajo");
      setLoading(false);
      return;
    }
    if (res.estado === "sin_config") {
      setConfig(null);
      setEstadoConfig("sin_config");
      setLoading(false);
      return;
    }
    setConfig(res.data);
    setEstadoConfig("ok");

    const solRes = await getSolicitudesVacaciones(res.data.legajoId);
    if (solRes.success && solRes.data) {
      setSolicitudes(
        solRes.data.map((s) => ({
          id: s.id,
          fechaDesde: s.fechaDesde,
          fechaHasta: s.fechaHasta,
          diasSolicitados: s.diasSolicitados,
          diasRestantes: s.diasRestantes,
          estado: s.estado,
        }))
      );
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    cargarDatos();
  }, [cargarDatos]);

  const [desde, hasta] = rango;
  const diasSeleccionados =
    desde && hasta ? calcularDiasVacaciones(desde, hasta) : 0;
  const restantes = config ? Math.max(0, config.diasRestantes) : 0;
  const diasRestarian = config ? restantes - diasSeleccionados : 0;
  const insuficientes = config ? diasSeleccionados > restantes : true;
  const puedeGuardar =
    config &&
    desde &&
    hasta &&
    !insuficientes &&
    diasSeleccionados > 0;

  const handleGuardarSolicitud = async () => {
    if (!config || !desde || !hasta) return;
    setGuardando(true);
    try {
      const res = await crearSolicitudVacaciones(config.legajoId, desde, hasta);
      if (!res.success) {
        alert(res.error ?? "Error al crear la solicitud");
        return;
      }
      if (res.data) {
        setSolicitudModal({
          open: true,
          diasSolicitados: res.data.diasSolicitados,
          diasRestantes: res.data.diasRestantes,
          solicitudId: res.data.id,
        });
        setRango([null, null]);
        cargarDatos();
      }
    } finally {
      setGuardando(false);
    }
  };

  const handleDescargar = (solicitudId: number) => {
    window.open(
      `/api/vacaciones/documento/${solicitudId}`,
      "_blank",
      "noopener,noreferrer"
    );
  };

  const handleEditarGuardar = async (fechaDesde: Date, fechaHasta: Date) => {
    if (!editarModal?.solicitud) return;
    await editarSolicitudVacaciones(
      editarModal.solicitud.id,
      fechaDesde,
      fechaHasta
    );
    setEditarModal(null);
    cargarDatos();
  };

  const handleDarDeBajaConfirm = async () => {
    if (!bajaModal) return;
    setBajaLoading(true);
    try {
      const res = await darDeBajaSolicitud(Number(bajaModal.id));
      if (!res.success) {
        alert(res.error ?? "Error al dar de baja");
        return;
      }
      setBajaModal(null);
      cargarDatos();
      emitNovedadesLiquidadoresRefresh();
    } finally {
      setBajaLoading(false);
    }
  };

  const handleEliminarFisico = (s: SolicitudTabla) => {
    setEliminarFisicoModal(s);
  };

  const handleEliminarFisicoConfirm = async () => {
    if (!eliminarFisicoModal) return;
    setEliminarFisicoLoading(true);
    try {
      const r = await fetch(`/api/vacaciones/${eliminarFisicoModal.id}/fisico`, { method: "DELETE" });
      if (!r.ok) {
        const err = await r.json();
        throw new Error(err.error ?? "Error");
      }
      setEliminarFisicoModal(null);
      cargarDatos();
      emitNovedadesLiquidadoresRefresh();
    } catch (e: unknown) {
      alert((e as Error).message);
    } finally {
      setEliminarFisicoLoading(false);
    }
  };

  const solicitudesParaCalendario = solicitudes.map((s) => ({
    fechaDesde: s.fechaDesde,
    fechaHasta: s.fechaHasta,
    estado: s.estado,
  }));

  const solicitudesParaEdicion = editarModal
    ? solicitudes
        .filter((s) => s.id !== editarModal.solicitud.id)
        .map((s) => ({
          fechaDesde: s.fechaDesde,
          fechaHasta: s.fechaHasta,
          estado: s.estado,
        }))
    : [];

  const diasDisponiblesParaEdicion = editarModal
    ? (config?.diasRestantes ?? 0)
    : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <Loader2 className="h-8 w-8 animate-spin text-[#4CAF50]" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-800 flex items-center gap-2">
          <Calendar className="h-7 w-7 text-[#4CAF50]" />
          Vacaciones
        </h1>
        <p className="text-gray-500 mt-1">
          Solicitá tus días de vacaciones y descargá el documento oficial
        </p>
      </div>

      {(estadoConfig === "sin_legajo" || estadoConfig === "sin_config") ? (
        <div
          className={`rounded-lg border px-4 py-3 ${
            estadoConfig === "sin_legajo"
              ? "border-red-200 bg-red-50 text-red-800"
              : "border-amber-200 bg-amber-50 text-amber-900"
          }`}
        >
          <p>
            {estadoConfig === "sin_legajo"
              ? "Tu usuario no está vinculado a un legajo. Contactá al administrador."
              : "Tus días de vacaciones aún no fueron configurados. Contactá a RRHH."}
          </p>
        </div>
      ) : config ? (
        <>
          {/* 7a. Encabezado informativo */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Resumen de días</CardTitle>
            </CardHeader>
            <CardContent>
              {(() => {
                const diasEnTramite = solicitudes
                  .filter((s) => s.estado === "PENDIENTE")
                  .reduce((sum, s) => sum + s.diasSolicitados, 0);
                const diasAprobados = solicitudes
                  .filter((s) => s.estado === "APROBADA")
                  .reduce((sum, s) => sum + s.diasSolicitados, 0);
                const diasRestantes = Math.max(
                  0,
                  config.diasDisponibles - diasAprobados
                );
                return (
                  <p className="text-sm text-gray-700">
                    <span className="font-medium">Disponibles:</span>{" "}
                    {config.diasDisponibles}
                    <span className="mx-2">|</span>
                    <span className="font-medium">En trámite (pendientes):</span>{" "}
                    {diasEnTramite}
                    <span className="mx-2">|</span>
                    <span className="font-medium">Aprobados:</span>{" "}
                    {diasAprobados}
                    <span className="mx-2">|</span>
                    <span className="font-medium">Restantes:</span>{" "}
                    {diasRestantes}
                  </p>
                );
              })()}
            </CardContent>
          </Card>

          {config.diasDisponibles === 0 && (
            <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              Si aún no tenés días asignados, contactá a RRHH para que configuren tu cupo.
            </p>
          )}

          {/* 7b. Calendario */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Calendario</CardTitle>
              <p className="text-sm text-gray-500">
                Cliqueá un día para seleccionarlo, o cliqueá dos días para un rango
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <CalendarioVacaciones
                value={rango}
                onChange={setRango}
                solicitudes={solicitudesParaCalendario}
                disabled={false}
              />

              {/* Contador en tiempo real */}
              <ContadorDias
                diasSeleccionados={diasSeleccionados}
                diasDisponibles={restantes}
                diasRestarian={diasRestarian}
                insuficientes={insuficientes}
              />

              <Button
                onClick={handleGuardarSolicitud}
                disabled={!puedeGuardar || guardando}
                className="bg-[#4CAF50] hover:bg-[#388E3C]"
              >
                {guardando ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Guardando...
                  </>
                ) : (
                  "Guardar solicitud"
                )}
              </Button>
            </CardContent>
          </Card>

          {/* 7d. Tabla de solicitudes */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Mis solicitudes</CardTitle>
            </CardHeader>
            <CardContent>
              <TablaSolicitudes
                solicitudes={solicitudes}
                onEditar={(s) =>
                  setEditarModal({ open: true, solicitud: s })
                }
                onDarDeBaja={(s) => setBajaModal(s)}
                onDescargar={handleDescargar}
                isSuperAdmin={esSuperAdmin}
                onEliminarFisico={handleEliminarFisico}
              />
            </CardContent>
          </Card>

          <div className="mt-6 flex justify-end">
            <Link
              href="/rrhh/vacaciones/historial"
              className="text-sm text-blue-600 hover:underline flex items-center gap-1"
            >
              📋 Ver historial completo
            </Link>
          </div>
        </>
      ) : null}

      {/* Modal post-guardado */}
      {solicitudModal && (
        <SolicitudModal
          open={solicitudModal.open}
          onClose={() => setSolicitudModal(null)}
          diasSolicitados={solicitudModal.diasSolicitados}
          diasRestantes={solicitudModal.diasRestantes}
          solicitudId={solicitudModal.solicitudId}
        />
      )}

      {/* Modal editar */}
      {editarModal && (
        <ModalEditarSolicitud
          open={editarModal.open}
          onClose={() => setEditarModal(null)}
          onGuardar={handleEditarGuardar}
          solicitudesExistentes={solicitudesParaEdicion}
          diasDisponiblesParaEdicion={diasDisponiblesParaEdicion}
        />
      )}

      {/* Modal confirmar baja */}
      <ModalConfirmarBaja
        open={!!bajaModal}
        onClose={() => setBajaModal(null)}
        onConfirm={handleDarDeBajaConfirm}
        loading={bajaLoading}
      />

      {/* Modal eliminar solicitud permanentemente (SUPER_ADMIN) */}
      {eliminarFisicoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4 shadow-xl">
            <h3 className="text-lg font-semibold text-red-700 mb-2">
              ⚠️ Eliminar solicitud permanentemente
            </h3>
            <p className="text-gray-600 text-sm mb-4">
              ¿Eliminás de forma permanente la solicitud del{" "}
              <strong>
                {formatearFecha(eliminarFisicoModal.fechaDesde)} al{" "}
                {formatearFecha(eliminarFisicoModal.fechaHasta)}
              </strong>
              ? Esta acción es irreversible.
            </p>
            <div className="flex justify-end gap-2 mt-4">
              <Button
                variant="outline"
                onClick={() => setEliminarFisicoModal(null)}
                disabled={eliminarFisicoLoading}
              >
                Cancelar
              </Button>
              <Button
                className="bg-red-600 hover:bg-red-700 text-white"
                onClick={handleEliminarFisicoConfirm}
                disabled={eliminarFisicoLoading}
              >
                {eliminarFisicoLoading ? "Eliminando..." : "Eliminar permanentemente"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
