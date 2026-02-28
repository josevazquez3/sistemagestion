"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, UserPlus, Eye, Pencil, UserMinus, FileText, FileDown, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { LegajoForm } from "./LegajoForm";
import { LegajoVerSheet } from "./LegajoVerSheet";

type Legajo = {
  id: string;
  numeroLegajo: number;
  nombres: string;
  apellidos: string;
  dni: string;
  fechaAlta: string;
  fechaBaja: string | null;
  fotoUrl: string | null;
  contactos: unknown[];
};

export default function LegajosPage() {
  const { data: session } = useSession();
  const roles = (session?.user as { roles?: string[] })?.roles ?? [];
  const canCreate = roles.includes("ADMIN") || roles.includes("RRHH");
  const canBaja = canCreate;

  const [tab, setTab] = useState<"activos" | "bajas">("activos");
  const [legajos, setLegajos] = useState<Legajo[]>([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [bajaModal, setBajaModal] = useState<{ id: string; nombre: string } | null>(null);
  const [bajaForm, setBajaForm] = useState({ fechaBaja: "", motivoBaja: "" });
  const [bajaSaving, setBajaSaving] = useState(false);

  const fetchLegajos = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        estado: tab === "activos" ? "activo" : "baja",
        page: String(pagination.page),
        ...(searchQuery ? { q: searchQuery } : {}),
      });
      const r = await fetch(`/api/legajos?${params}`);
      if (!r.ok) throw new Error("Error");
      const data = await r.json();
      setLegajos(data.data);
      setPagination((p) => ({ ...p, ...data.pagination }));
    } catch {
      setLegajos([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLegajos();
  }, [tab, pagination.page, searchQuery]);

  const handleSearch = () => {
    setSearchQuery(search);
    setPagination((p) => ({ ...p, page: 1 }));
  };

  const openBaja = (l: Legajo) => {
    setBajaModal({ id: l.id, nombre: `${l.apellidos} ${l.nombres}` });
    setBajaForm({ fechaBaja: new Date().toISOString().split("T")[0], motivoBaja: "" });
  };

  const confirmBaja = async () => {
    if (!bajaModal || !bajaForm.fechaBaja || !bajaForm.motivoBaja.trim()) return;
    setBajaSaving(true);
    try {
      const r = await fetch(`/api/legajos/${bajaModal.id}/baja`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bajaForm),
      });
      if (!r.ok) {
        const err = await r.json();
        throw new Error(err.error ?? "Error");
      }
      setBajaModal(null);
      fetchLegajos();
      setTab("bajas");
    } catch (e: unknown) {
      alert((e as Error).message);
    } finally {
      setBajaSaving(false);
    }
  };

  const formatFecha = (s: string) => (s ? new Date(s).toLocaleDateString("es-AR") : "-");

  return (
    <div className="max-w-6xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-800">Legajos</h1>
          <p className="text-gray-500 mt-1">Recursos Humanos - Gestión de legajos</p>
        </div>
        {canCreate && (
          <Button onClick={() => { setEditingId(null); setShowForm(true); }} className="bg-[#4CAF50] hover:bg-[#388E3C] text-white">
            <UserPlus className="h-4 w-4 mr-2" />
            Nuevo Legajo
          </Button>
        )}
      </div>

      {/* Pestañas */}
      <div className="flex gap-2 border-b">
        <button
          onClick={() => setTab("activos")}
          className={`px-4 py-2 font-medium border-b-2 -mb-px transition-colors ${
            tab === "activos" ? "border-[#4CAF50] text-[#388E3C]" : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          Legajos Activos
        </button>
        <button
          onClick={() => setTab("bajas")}
          className={`px-4 py-2 font-medium border-b-2 -mb-px transition-colors ${
            tab === "bajas" ? "border-[#4CAF50] text-[#388E3C]" : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          Bajas
        </button>
      </div>

      {/* Buscador y filtro */}
      <div className="flex flex-wrap gap-3">
        <div className="flex gap-2 flex-1 min-w-[200px]">
          <Input
            placeholder="Buscar por nombre, apellido, DNI o nº legajo"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          />
          <Button onClick={handleSearch} variant="outline" size="icon">
            <Search className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Tabla */}
      <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-12 flex justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-[#4CAF50]" />
          </div>
        ) : (
          <>
            <table className="w-full">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Foto</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nº Legajo</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Apellido y Nombre</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">DNI</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fecha Alta</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estado</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {legajos.map((l) => (
                  <tr key={l.id} className="border-b hover:bg-[#E8F5E9]">
                    <td className="px-6 py-4">
                      <div className="h-10 w-10 rounded-full bg-[#C8E6C9] flex items-center justify-center overflow-hidden">
                        {l.fotoUrl ? (
                          <img src={l.fotoUrl} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <span className="text-[#388E3C] font-medium">
                            {(l.apellidos[0] || "") + (l.nombres[0] || "")}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 font-medium">{l.numeroLegajo}</td>
                    <td className="px-6 py-4">{`${l.apellidos}, ${l.nombres}`}</td>
                    <td className="px-6 py-4">{l.dni}</td>
                    <td className="px-6 py-4">{formatFecha(l.fechaAlta)}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${l.fechaBaja ? "bg-gray-100 text-gray-600" : "bg-green-100 text-green-800"}`}>
                        {l.fechaBaja ? "Baja" : "Activo"}
                      </span>
                    </td>
                    <td className="px-6 py-4 flex gap-2">
                      <Button variant="ghost" size="icon-sm" onClick={() => setViewingId(l.id)} title="Ver">
                        <Eye className="h-4 w-4" />
                      </Button>
                      {!l.fechaBaja && canCreate && (
                        <Button variant="ghost" size="icon-sm" onClick={() => { setEditingId(l.id); setShowForm(true); }} title="Editar">
                          <Pencil className="h-4 w-4" />
                        </Button>
                      )}
                      {!l.fechaBaja && canBaja && (
                        <Button variant="ghost" size="icon-sm" onClick={() => openBaja(l)} className="text-red-600 hover:text-red-700" title="Dar de baja">
                          <UserMinus className="h-4 w-4" />
                        </Button>
                      )}
                      <a href={`/api/legajos/${l.id}/export-pdf`} download className="inline-flex">
                        <Button variant="ghost" size="icon-sm" title="Exportar PDF" className="text-[#4CAF50] hover:text-[#388E3C]">
                          <FileText className="h-4 w-4" />
                        </Button>
                      </a>
                      <a href={`/api/legajos/${l.id}/export-word`} download className="inline-flex">
                        <Button variant="ghost" size="icon-sm" title="Exportar DOCX" className="text-[#4CAF50] hover:text-[#388E3C]">
                          <FileDown className="h-4 w-4" />
                        </Button>
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {legajos.length === 0 && (
              <div className="py-12 text-center text-gray-500">No hay legajos.</div>
            )}
            {pagination.totalPages > 1 && (
              <div className="px-6 py-3 border-t flex justify-between items-center">
                <span className="text-sm text-gray-500">
                  Página {pagination.page} de {pagination.totalPages} ({pagination.total} registros)
                </span>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" disabled={pagination.page <= 1} onClick={() => setPagination((p) => ({ ...p, page: p.page - 1 }))}>
                    Anterior
                  </Button>
                  <Button variant="outline" size="sm" disabled={pagination.page >= pagination.totalPages} onClick={() => setPagination((p) => ({ ...p, page: p.page + 1 }))}>
                    Siguiente
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Modal Dar de baja */}
      <Dialog open={!!bajaModal} onOpenChange={(o) => !o && setBajaModal(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Dar de baja legajo</DialogTitle>
            <DialogDescription>
              {bajaModal && `Confirmar baja de ${bajaModal.nombre}. El legajo pasará a la pestaña Bajas y no podrá editarse.`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Fecha de Baja</label>
              <Input
                type="date"
                value={bajaForm.fechaBaja}
                onChange={(e) => setBajaForm((f) => ({ ...f, fechaBaja: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Motivo</label>
              <Input
                value={bajaForm.motivoBaja}
                onChange={(e) => setBajaForm((f) => ({ ...f, motivoBaja: e.target.value }))}
                placeholder="Motivo de la baja"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBajaModal(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={confirmBaja} disabled={bajaSaving || !bajaForm.motivoBaja.trim()}>
              {bajaSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Dar de baja"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Formulario crear/editar */}
      <LegajoForm
        open={showForm}
        onOpenChange={(o) => { setShowForm(o); if (!o) setEditingId(null); }}
        editingId={editingId}
        onSuccess={() => { fetchLegajos(); setShowForm(false); setEditingId(null); }}
      />

      {/* Ver legajo */}
      <LegajoVerSheet legajoId={viewingId} onClose={() => setViewingId(null)} />
    </div>
  );
}
