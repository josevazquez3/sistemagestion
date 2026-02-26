"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  getConfiguracionVacaciones,
  setConfiguracionVacaciones,
  getSolicitudesVacaciones,
  aprobarSolicitudVacaciones,
  darDeBajaSolicitud,
  getUsuariosParaVinculacion,
  vincularUsuarioLegajo,
  desvincularUsuarioLegajo,
} from "@/app/actions/vacaciones";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatearFecha } from "@/lib/vacaciones.utils";
import { Loader2, Settings, Users, Search, FileDown, Trash2, Link2, Unlink, Check } from "lucide-react";

type Legajo = {
  id: string;
  numeroLegajo: number;
  nombres: string;
  apellidos: string;
};

type SolicitudAdmin = {
  id: number;
  fechaDesde: Date;
  fechaHasta: Date;
  diasSolicitados: number;
  diasRestantes: number;
  estado: string;
};

type UsuarioVinculacion = {
  id: string;
  nombre: string;
  email: string;
  legajoId: string | null;
  legajo: { id: string; numeroLegajo: number; label: string } | null;
};

const estadoBadgeClass: Record<string, string> = {
  PENDIENTE: "bg-amber-100 text-amber-800 border-amber-300",
  APROBADA: "bg-green-100 text-green-800 border-green-300",
  BAJA: "bg-red-100 text-red-800 border-red-300 line-through",
};

export default function VacacionesAdminPage() {
  const { data: session } = useSession();
  const roles = (session?.user as { roles?: string[] })?.roles ?? [];
  const esAdmin = roles.includes("ADMIN") || roles.includes("RRHH");

  const [legajos, setLegajos] = useState<Legajo[]>([]);
  const [legajosLoading, setLegajosLoading] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [empleadoId, setEmpleadoId] = useState<string | null>(null);
  const [empleadoNombre, setEmpleadoNombre] = useState("");
  const [config, setConfig] = useState<{
    diasDisponibles: number;
    secretarioGeneral: string;
  } | null>(null);
  const [diasDisponibles, setDiasDisponibles] = useState("");
  const [secretarioGeneral, setSecretarioGeneral] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [feedback, setFeedback] = useState<{
    tipo: "success" | "error";
    mensaje: string;
  } | null>(null);
  const [solicitudes, setSolicitudes] = useState<SolicitudAdmin[]>([]);
  const [solicitudesLoading, setSolicitudesLoading] = useState(false);
  const [bajaModal, setBajaModal] = useState<SolicitudAdmin | null>(null);
  const [bajaLoading, setBajaLoading] = useState(false);
  const [aprobarLoading, setAprobarLoading] = useState<number | null>(null);
  const [usuariosVinculacion, setUsuariosVinculacion] = useState<UsuarioVinculacion[]>([]);
  const [vinculacionLoading, setVinculacionLoading] = useState(false);
  const [vinculandoId, setVinculandoId] = useState<string | null>(null);
  const [legajoSeleccionadoPorUsuario, setLegajoSeleccionadoPorUsuario] = useState<Record<string, string>>({});

  const cargarUsuariosVinculacion = useCallback(async () => {
    setVinculacionLoading(true);
    try {
      const res = await getUsuariosParaVinculacion();
      if (res.success && res.data) {
        setUsuariosVinculacion(res.data);
      }
    } finally {
      setVinculacionLoading(false);
    }
  }, []);

  useEffect(() => {
    if (esAdmin) cargarUsuariosVinculacion();
  }, [esAdmin, cargarUsuariosVinculacion]);

  const handleVincular = async (userId: string) => {
    const legajoId = legajoSeleccionadoPorUsuario[userId];
    if (!legajoId) {
      alert("Seleccioná un legajo.");
      return;
    }
    setVinculandoId(userId);
    try {
      const res = await vincularUsuarioLegajo(userId, legajoId);
      if (res.success) {
        await cargarUsuariosVinculacion();
        setLegajoSeleccionadoPorUsuario((p) => {
          const next = { ...p };
          delete next[userId];
          return next;
        });
      } else {
        alert(res.error ?? "Error al vincular");
      }
    } finally {
      setVinculandoId(null);
    }
  };

  const handleDesvincular = async (userId: string) => {
    if (!confirm("¿Desvincular este usuario del legajo?")) return;
    setVinculandoId(userId);
    try {
      const res = await desvincularUsuarioLegajo(userId);
      if (res.success) {
        await cargarUsuariosVinculacion();
      } else {
        alert(res.error ?? "Error al desvincular");
      }
    } finally {
      setVinculandoId(null);
    }
  };

  const legajosFiltrados = legajos.filter((l) => {
    const q = busqueda.toLowerCase().trim();
    if (!q) return true;
    return (
      l.nombres.toLowerCase().includes(q) ||
      l.apellidos.toLowerCase().includes(q) ||
      l.numeroLegajo.toString().includes(q)
    );
  });

  const cargarLegajos = useCallback(async () => {
    setLegajosLoading(true);
    try {
      const r = await fetch(
        "/api/legajos?estado=activo&page=1&perPage=500"
      );
      if (!r.ok) throw new Error("Error al cargar legajos");
      const data = await r.json();
      setLegajos(data.data ?? []);
    } catch {
      setLegajos([]);
    } finally {
      setLegajosLoading(false);
    }
  }, []);

  useEffect(() => {
    cargarLegajos();
  }, [cargarLegajos]);

  const cargarConfigYSolicitudes = useCallback(async (legId: string) => {
    setSolicitudesLoading(true);
    const configRes = await getConfiguracionVacaciones(legId);
    const solRes = await getSolicitudesVacaciones(legId);

    if (configRes.success && configRes.data) {
      setConfig(configRes.data);
      setDiasDisponibles(String(configRes.data.diasDisponibles));
      setSecretarioGeneral(configRes.data.secretarioGeneral);
    } else {
      setConfig(null);
      setDiasDisponibles("");
      setSecretarioGeneral("");
    }

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
    } else {
      setSolicitudes([]);
    }
    setSolicitudesLoading(false);
  }, []);

  useEffect(() => {
    if (empleadoId) {
      cargarConfigYSolicitudes(empleadoId);
    } else {
      setConfig(null);
      setDiasDisponibles("");
      setSecretarioGeneral("");
      setSolicitudes([]);
    }
  }, [empleadoId, cargarConfigYSolicitudes]);

  const handleGuardarConfig = async () => {
    if (!empleadoId) return;
    const dias = parseInt(diasDisponibles, 10);
    if (isNaN(dias) || dias < 0) {
      setFeedback({ tipo: "error", mensaje: "Días disponibles debe ser un número válido." });
      return;
    }
    if (!secretarioGeneral.trim()) {
      setFeedback({ tipo: "error", mensaje: "El nombre del Secretario General es requerido." });
      return;
    }

    setGuardando(true);
    setFeedback(null);
    try {
      const res = await setConfiguracionVacaciones(
        empleadoId,
        dias,
        secretarioGeneral.trim()
      );
      if (res.success) {
        setFeedback({ tipo: "success", mensaje: "Configuración guardada correctamente." });
        setConfig({ diasDisponibles: dias, secretarioGeneral: secretarioGeneral.trim() });
      } else {
        setFeedback({ tipo: "error", mensaje: res.error ?? "Error al guardar." });
      }
    } finally {
      setGuardando(false);
    }
  };

  const handleAprobar = async (s: SolicitudAdmin) => {
    if (s.estado !== "PENDIENTE") return;
    setAprobarLoading(s.id);
    try {
      const res = await aprobarSolicitudVacaciones(Number(s.id));
      if (res.success) {
        if (empleadoId) cargarConfigYSolicitudes(empleadoId);
      } else {
        alert(res.error ?? "Error al aprobar");
      }
    } finally {
      setAprobarLoading(null);
    }
  };

  const handleDarDeBaja = async (s: SolicitudAdmin) => {
    setBajaModal(s);
  };

  const handleConfirmarBaja = async () => {
    if (!bajaModal) return;
    setBajaLoading(true);
    try {
      const res = await darDeBajaSolicitud(Number(bajaModal.id));
      if (res.success) {
        setBajaModal(null);
        if (empleadoId) cargarConfigYSolicitudes(empleadoId);
      } else {
        alert(res.error ?? "Error al dar de baja");
      }
    } finally {
      setBajaLoading(false);
    }
  };

  const handleDescargar = (solicitudId: number) => {
    window.open(
      `/api/vacaciones/documento/${solicitudId}`,
      "_blank",
      "noopener,noreferrer"
    );
  };

  if (!esAdmin) {
    return (
      <div className="max-w-6xl">
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-800">
          No tenés permisos para acceder a esta sección.
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-800 flex items-center gap-2">
          <Settings className="h-7 w-7 text-[#4CAF50]" />
          Administración de Vacaciones
        </h1>
        <p className="text-gray-500 mt-1">
          Vincular usuarios a legajos, configurar días disponibles y el destinatario del documento
        </p>
      </div>

      {/* 6b. Vinculación Usuario ↔ Legajo */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Link2 className="h-5 w-5" />
            Vinculación Usuario ↔ Legajo
          </CardTitle>
          <p className="text-sm text-gray-500">
            Los empleados deben tener su usuario vinculado a un legajo para usar el módulo de vacaciones.
          </p>
        </CardHeader>
        <CardContent>
          {vinculacionLoading && usuariosVinculacion.length === 0 ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-[#4CAF50]" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Usuario</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Legajo vinculado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {usuariosVinculacion.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">{u.nombre}</TableCell>
                    <TableCell>{u.email}</TableCell>
                    <TableCell>
                      {u.legajo ? (
                        <span className="inline-flex items-center rounded-full border border-green-300 bg-green-50 px-2 py-0.5 text-xs font-medium text-green-800">
                          {u.legajo.label}
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full border border-red-300 bg-red-50 px-2 py-0.5 text-xs font-medium text-red-800">
                          Sin legajo
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2 items-center">
                        {u.legajo ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDesvincular(u.id)}
                            disabled={vinculandoId === u.id}
                          >
                            {vinculandoId === u.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <>
                                <Unlink className="h-4 w-4 mr-1" />
                                Desvincular
                              </>
                            )}
                          </Button>
                        ) : (
                          <>
                            <select
                              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                              value={legajoSeleccionadoPorUsuario[u.id] ?? ""}
                              onChange={(e) =>
                                setLegajoSeleccionadoPorUsuario((p) => ({
                                  ...p,
                                  [u.id]: e.target.value,
                                }))
                              }
                            >
                              <option value="">Seleccionar legajo...</option>
                              {legajos.map((l) => (
                                <option key={l.id} value={l.id}>
                                  {l.apellidos}, {l.nombres} (Leg. {l.numeroLegajo})
                                </option>
                              ))}
                            </select>
                            <Button
                              size="sm"
                              onClick={() => handleVincular(u.id)}
                              disabled={
                                !legajoSeleccionadoPorUsuario[u.id] || vinculandoId === u.id
                              }
                              className="bg-[#4CAF50] hover:bg-[#388E3C]"
                            >
                              {vinculandoId === u.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <>
                                  <Link2 className="h-4 w-4 mr-1" />
                                  Vincular
                                </>
                              )}
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Panel de configuración */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-5 w-5" />
            Configuración por empleado
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Selector de empleado con búsqueda */}
          <div className="space-y-2">
            <Label>Empleado</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Buscar por nombre, apellido o número de legajo..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="border rounded-lg max-h-48 overflow-y-auto">
              {legajosLoading ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="h-6 w-6 animate-spin text-[#4CAF50]" />
                </div>
              ) : (
                legajosFiltrados.map((l) => (
                  <button
                    key={l.id}
                    type="button"
                    onClick={() => {
                      setEmpleadoId(l.id);
                      setEmpleadoNombre(`${l.apellidos}, ${l.nombres}`);
                      setBusqueda("");
                    }}
                    className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 border-b last:border-b-0 ${
                      empleadoId === l.id ? "bg-[#E8F5E9] text-[#388E3C]" : ""
                    }`}
                  >
                    {l.apellidos}, {l.nombres} (Leg. {l.numeroLegajo})
                  </button>
                ))
              )}
              {!legajosLoading && legajosFiltrados.length === 0 && (
                <p className="text-gray-500 text-center py-4">Sin resultados</p>
              )}
            </div>
            {empleadoId && (
              <p className="text-sm text-gray-600">
                Seleccionado: <span className="font-medium">{empleadoNombre}</span>
              </p>
            )}
          </div>

          {empleadoId && (
            <>
              <div className="grid gap-4 sm:grid-cols-2 pt-2">
                <div className="space-y-2">
                  <Label htmlFor="dias">Días de vacaciones disponibles</Label>
                  <Input
                    id="dias"
                    type="number"
                    min={0}
                    max={365}
                    value={diasDisponibles}
                    onChange={(e) => setDiasDisponibles(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="secretario">
                    Nombre del Secretario/a General destinatario
                  </Label>
                  <Input
                    id="secretario"
                    value={secretarioGeneral}
                    onChange={(e) => setSecretarioGeneral(e.target.value)}
                    placeholder="Dr./Dra. Nombre Apellido"
                  />
                </div>
              </div>

              <Button
                onClick={handleGuardarConfig}
                disabled={guardando}
                className="bg-[#4CAF50] hover:bg-[#388E3C]"
              >
                {guardando ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Guardando...
                  </>
                ) : (
                  "Guardar configuración"
                )}
              </Button>

              {feedback && (
                <div
                  className={`rounded-lg border px-4 py-2 text-sm ${
                    feedback.tipo === "success"
                      ? "border-green-200 bg-green-50 text-green-800"
                      : "border-red-200 bg-red-50 text-red-800"
                  }`}
                >
                  {feedback.mensaje}
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Tabla de solicitudes del empleado seleccionado */}
      {empleadoId && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Solicitudes de {empleadoNombre}</CardTitle>
          </CardHeader>
          <CardContent>
            {solicitudesLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-[#4CAF50]" />
              </div>
            ) : solicitudes.length === 0 ? (
              <p className="text-gray-500 text-center py-8">
                Este empleado no tiene solicitudes registradas.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Desde</TableHead>
                    <TableHead>Hasta</TableHead>
                    <TableHead>Días</TableHead>
                    <TableHead>Restantes</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {solicitudes.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell>{formatearFecha(s.fechaDesde)}</TableCell>
                      <TableCell>{formatearFecha(s.fechaHasta)}</TableCell>
                      <TableCell>{s.diasSolicitados}</TableCell>
                      <TableCell>{s.diasRestantes}</TableCell>
                      <TableCell>
                        <span
                          className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${
                            estadoBadgeClass[s.estado] ?? ""
                          }`}
                        >
                          {s.estado}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => handleDescargar(s.id)}
                            title="Descargar documento"
                          >
                            <FileDown className="h-4 w-4" />
                          </Button>
                          {s.estado === "PENDIENTE" && (
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => handleAprobar(s)}
                              disabled={aprobarLoading !== null}
                              title="Aprobar"
                              className="text-green-600 hover:text-green-700 hover:bg-green-50"
                            >
                              {aprobarLoading === s.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Check className="h-4 w-4" />
                              )}
                            </Button>
                          )}
                          {(s.estado === "PENDIENTE" || s.estado === "APROBADA") && (
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => handleDarDeBaja(s)}
                              title="Dar de baja"
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {/* Modal confirmar baja */}
      {bajaModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4 shadow-xl">
            <h3 className="text-lg font-semibold text-amber-700 mb-2">
              Dar de baja la solicitud
            </h3>
            <p className="text-gray-600 text-sm mb-4">
              ¿Estás seguro de que querés dar de baja esta solicitud de vacaciones?
              Esta acción no se puede deshacer.
            </p>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setBajaModal(null)}
                disabled={bajaLoading}
              >
                Cancelar
              </Button>
              <Button
                variant="destructive"
                onClick={handleConfirmarBaja}
                disabled={bajaLoading}
              >
                {bajaLoading ? "Procesando..." : "Dar de baja"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
