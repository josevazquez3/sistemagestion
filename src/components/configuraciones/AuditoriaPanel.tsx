"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FileDown, FileText, ChevronLeft, ChevronRight, Search, X } from "lucide-react";
import {
  exportarPDF,
  exportarDOCX,
  descargarBlob,
  type LogAuditoria,
  type OpcionesExportacion,
} from "@/lib/exportarAuditoria";

const MODULOS = [
  { value: "", label: "Todos" },
  { value: "Licencias", label: "Licencias" },
  { value: "Legajos", label: "Legajos" },
  { value: "Vacaciones", label: "Vacaciones" },
  { value: "Usuarios", label: "Usuarios" },
  { value: "Configuraciones", label: "Configuraciones" },
];

function formatearFechaArgentina(iso: string): string {
  const d = new Date(iso);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  const h = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  const s = String(d.getSeconds()).padStart(2, "0");
  return `${day}/${month}/${year} ${h}:${min}:${s}`;
}

function formatearFechaInput(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function AuditoriaPanel() {
  const [usuarios, setUsuarios] = useState<{ id: string; nombre: string; email: string }[]>([]);
  const [logs, setLogs] = useState<LogAuditoria[]>([]);
  const [pagination, setPagination] = useState({ page: 1, perPage: 20, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(false);
  const [exportando, setExportando] = useState<"pdf" | "docx" | null>(null);

  const [filtroUsuario, setFiltroUsuario] = useState("");
  const [filtroModulo, setFiltroModulo] = useState("");
  const [filtroDesde, setFiltroDesde] = useState("");
  const [filtroHasta, setFiltroHasta] = useState("");

  const nombreSistema = typeof process.env.NEXT_PUBLIC_APP_NAME === "string"
    ? process.env.NEXT_PUBLIC_APP_NAME
    : "Sistema de Gestión";

  const cargarUsuarios = useCallback(async () => {
    const res = await fetch("/api/auditoria/usuarios");
    if (!res.ok) return;
    const data = await res.json();
    setUsuarios(data.data ?? []);
  }, []);

  const buscar = useCallback(
    async (page = 1) => {
      setLoading(true);
      const params = new URLSearchParams();
      if (filtroUsuario) params.set("userId", filtroUsuario);
      if (filtroModulo) params.set("modulo", filtroModulo);
      if (filtroDesde) params.set("desde", filtroDesde);
      if (filtroHasta) params.set("hasta", filtroHasta);
      params.set("page", String(page));
      params.set("perPage", "20");
      const res = await fetch(`/api/auditoria?${params}`);
      setLoading(false);
      if (!res.ok) return;
      const data = await res.json();
      setLogs(data.data ?? []);
      setPagination(data.pagination ?? { page: 1, perPage: 20, total: 0, totalPages: 0 });
    },
    [filtroUsuario, filtroModulo, filtroDesde, filtroHasta]
  );

  useEffect(() => {
    cargarUsuarios();
  }, [cargarUsuarios]);

  useEffect(() => {
    buscar(1);
  }, []);

  const limpiarFiltros = () => {
    setFiltroUsuario("");
    setFiltroModulo("");
    setFiltroDesde("");
    setFiltroHasta("");
    setTimeout(() => buscar(1), 0);
  };

  const usuarioSeleccionado = usuarios.find((u) => u.id === filtroUsuario);

  const opcionesExportacion = (): OpcionesExportacion => {
    const ahora = new Date();
    const d = String(ahora.getDate()).padStart(2, "0");
    const m = String(ahora.getMonth() + 1).padStart(2, "0");
    const y = ahora.getFullYear();
    const h = String(ahora.getHours()).padStart(2, "0");
    const min = String(ahora.getMinutes()).padStart(2, "0");
    const fechaGen = `${d}/${m}/${y} ${h}:${min}`;
    const desdeStr = filtroDesde
      ? (() => {
          const x = new Date(filtroDesde);
          return `${String(x.getDate()).padStart(2, "0")}/${String(x.getMonth() + 1).padStart(2, "0")}/${x.getFullYear()}`;
        })()
      : undefined;
    const hastaStr = filtroHasta
      ? (() => {
          const x = new Date(filtroHasta);
          return `${String(x.getDate()).padStart(2, "0")}/${String(x.getMonth() + 1).padStart(2, "0")}/${x.getFullYear()}`;
        })()
      : undefined;
    return {
      nombreSistema,
      periodoDesde: desdeStr,
      periodoHasta: hastaStr,
      usuarioNombre: usuarioSeleccionado ? usuarioSeleccionado.nombre : "Todos los usuarios",
      fechaGeneracion: fechaGen,
    };
  };

  const exportar = async (formato: "pdf" | "docx", todosLosRegistros: boolean) => {
    setExportando(formato);
    try {
      const params = new URLSearchParams();
      if (filtroUsuario) params.set("userId", filtroUsuario);
      if (filtroModulo) params.set("modulo", filtroModulo);
      if (filtroDesde) params.set("desde", filtroDesde);
      if (filtroHasta) params.set("hasta", filtroHasta);
      params.set("page", "1");
      params.set("perPage", "10000");
      const res = await fetch(`/api/auditoria?${params}`);
      if (!res.ok) return;
      const data = await res.json();
      const listado: LogAuditoria[] = data.data ?? [];
      const opciones = opcionesExportacion();
      const blob =
        formato === "pdf"
          ? await exportarPDF(listado, opciones)
          : await exportarDOCX(listado, opciones);
      const ext = formato === "pdf" ? "pdf" : "docx";
      const nombre =
        usuarioSeleccionado
          ? `auditoria_${usuarioSeleccionado.nombre.replace(/\s+/g, "_")}.${ext}`
          : `auditoria.${ext}`;
      descargarBlob(blob, nombre);
    } finally {
      setExportando(null);
    }
  };

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-gray-800 mb-1">Auditoría del Sistema</h2>
      <p className="text-sm text-gray-600 mb-4">
        Consultá el historial de acciones realizadas en el sistema.
      </p>

      {/* Filtros */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 mb-4">
        <div>
          <Label className="text-xs">Usuario</Label>
          <select
            value={filtroUsuario}
            onChange={(e) => setFiltroUsuario(e.target.value)}
            className="mt-1 h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
          >
            <option value="">Todos</option>
            {usuarios.map((u) => (
              <option key={u.id} value={u.id}>
                {u.nombre}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label className="text-xs">Módulo</Label>
          <select
            value={filtroModulo}
            onChange={(e) => setFiltroModulo(e.target.value)}
            className="mt-1 h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
          >
            {MODULOS.map((m) => (
              <option key={m.value || "todos"} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label className="text-xs">Desde</Label>
          <Input
            type="date"
            value={filtroDesde}
            onChange={(e) => setFiltroDesde(e.target.value)}
            className="mt-1 h-9"
          />
        </div>
        <div>
          <Label className="text-xs">Hasta</Label>
          <Input
            type="date"
            value={filtroHasta}
            onChange={(e) => setFiltroHasta(e.target.value)}
            className="mt-1 h-9"
          />
        </div>
        <div className="flex items-end gap-2">
          <Button type="button" onClick={() => buscar(1)} size="sm" className="bg-[#4CAF50] hover:bg-[#388E3C]">
            <Search className="h-4 w-4 mr-1" />
            Buscar
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={limpiarFiltros}>
            <X className="h-4 w-4 mr-1" />
            Limpiar
          </Button>
        </div>
      </div>

      {/* Exportación */}
      <div className="flex flex-wrap gap-2 mb-4">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!!exportando}
          onClick={() => exportar("pdf", true)}
        >
          {exportando === "pdf" ? "..." : <FileDown className="h-4 w-4 mr-1" />}
          Exportar PDF
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!!exportando}
          onClick={() => exportar("docx", true)}
        >
          {exportando === "docx" ? "..." : <FileText className="h-4 w-4 mr-1" />}
          Exportar DOCX
        </Button>
        {usuarioSeleccionado && (
          <>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!!exportando}
              onClick={() => exportar("pdf", true)}
            >
              Exportar PDF de {usuarioSeleccionado.nombre}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!!exportando}
              onClick={() => exportar("docx", true)}
            >
              Exportar DOCX de {usuarioSeleccionado.nombre}
            </Button>
          </>
        )}
      </div>

      {/* Tabla */}
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Cargando...</div>
        ) : logs.length === 0 ? (
          <div className="p-8 text-center text-gray-500">No se encontraron registros de auditoría.</div>
        ) : (
          <>
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left py-2 px-3 font-medium text-gray-700">Fecha y hora</th>
                  <th className="text-left py-2 px-3 font-medium text-gray-700">Usuario</th>
                  <th className="text-left py-2 px-3 font-medium text-gray-700">Email</th>
                  <th className="text-left py-2 px-3 font-medium text-gray-700">Módulo</th>
                  <th className="text-left py-2 px-3 font-medium text-gray-700">Acción</th>
                  <th className="text-left py-2 px-3 font-medium text-gray-700">Detalle</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log, idx) => (
                  <tr key={log.id ?? `${log.creadoEn}-${idx}`} className="border-b border-gray-100 hover:bg-gray-50/50">
                    <td className="py-2 px-3 text-gray-600 whitespace-nowrap">
                      {formatearFechaArgentina(log.creadoEn)}
                    </td>
                    <td className="py-2 px-3">{log.userNombre}</td>
                    <td className="py-2 px-3 text-gray-600">{log.userEmail}</td>
                    <td className="py-2 px-3">{log.modulo}</td>
                    <td className="py-2 px-3">{log.accion}</td>
                    <td className="py-2 px-3 text-gray-600 max-w-xs truncate">{log.detalle ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {pagination.totalPages > 1 && (
              <div className="flex items-center justify-between px-3 py-2 border-t border-gray-200 bg-gray-50">
                <span className="text-xs text-gray-600">
                  Página {pagination.page} de {pagination.totalPages} ({pagination.total} registros)
                </span>
                <div className="flex gap-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={pagination.page <= 1}
                    onClick={() => buscar(pagination.page - 1)}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Anterior
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={pagination.page >= pagination.totalPages}
                    onClick={() => buscar(pagination.page + 1)}
                  >
                    Siguiente
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}
