"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import * as XLSX from "xlsx";
import {
  Check,
  FileSpreadsheet,
  FileText,
  FileX,
  Pencil,
  Plus,
  Search,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Proveedor = {
  id: number;
  proveedor: string;
  nombreContacto: string | null;
  alias: string | null;
  cuit: string | null;
  cuentaDebitoTipoNum: string | null;
  banco: string | null;
  direccion: string | null;
  ciudad: string | null;
  telefono: string | null;
  email: string | null;
  formaPago: string | null;
  cbu: string | null;
  noEmiteFactura: boolean;
};

type Toast = { tipo: "ok" | "error" | "warning"; text: string } | null;

type ProveedorForm = Omit<Proveedor, "id">;
type DuplicateCheckResult = { isDuplicate: boolean; motivo: string | null };
type BulkProveedorRow = ProveedorForm & {
  isDuplicate: boolean;
  motivo: string | null;
};

const formVacio: ProveedorForm = {
  proveedor: "",
  nombreContacto: "",
  alias: "",
  cuit: "",
  cuentaDebitoTipoNum: "",
  banco: "",
  direccion: "",
  ciudad: "",
  telefono: "",
  email: "",
  formaPago: "TRANSFERENCIA",
  cbu: "",
  noEmiteFactura: false,
};

export function ProveedoresContent() {
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<Toast>(null);
  const [search, setSearch] = useState("");

  const [openAlta, setOpenAlta] = useState(false);
  const [guardandoAlta, setGuardandoAlta] = useState(false);
  const [formAlta, setFormAlta] = useState<ProveedorForm>(formVacio);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [draft, setDraft] = useState<ProveedorForm | null>(null);
  const [savingInline, setSavingInline] = useState(false);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [confirmBulkOpen, setConfirmBulkOpen] = useState(false);
  const [deletingBulk, setDeletingBulk] = useState(false);
  const headerCheckboxRef = useRef<HTMLInputElement | null>(null);
  const selectionZoneRef = useRef<HTMLDivElement | null>(null);

  const [openBulk, setOpenBulk] = useState(false);
  const [bulkRows, setBulkRows] = useState<BulkProveedorRow[]>([]);
  const [bulkInfo, setBulkInfo] = useState("");
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkChecking, setBulkChecking] = useState(false);
  const [includeDuplicates, setIncludeDuplicates] = useState(false);
  const [bulkResult, setBulkResult] = useState<{ insertados: number; actualizados: number; errores: string[] } | null>(null);
  const [togglingNoEmiteId, setTogglingNoEmiteId] = useState<number | null>(null);

  const showToast = useCallback((tipo: "ok" | "error" | "warning", text: string) => {
    setToast({ tipo, text });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    const visibleIds = proveedores.map((p) => p.id);
    setSelectedIds((prev) => prev.filter((id) => visibleIds.includes(id)));
  }, [proveedores]);

  useEffect(() => {
    if (editingId == null) return;
    setSelectedIds((prev) => prev.filter((id) => id !== editingId));
  }, [editingId]);

  useEffect(() => {
    const nSeleccionables = proveedores.filter((p) => p.id !== editingId).length;
    const nSeleccionados = selectedIds.filter((id) => id !== editingId).length;
    if (!headerCheckboxRef.current) return;
    headerCheckboxRef.current.checked = nSeleccionables > 0 && nSeleccionados === nSeleccionables;
    headerCheckboxRef.current.indeterminate =
      nSeleccionables > 0 && nSeleccionados > 0 && nSeleccionados < nSeleccionables;
  }, [selectedIds, proveedores, editingId]);

  useEffect(() => {
    function handleOutsideSelection(e: MouseEvent) {
      if (selectedIds.length === 0) return;
      if (!selectionZoneRef.current) return;
      if (!selectionZoneRef.current.contains(e.target as Node)) {
        setSelectedIds([]);
      }
    }
    document.addEventListener("mousedown", handleOutsideSelection);
    return () => document.removeEventListener("mousedown", handleOutsideSelection);
  }, [selectedIds.length]);

  const fetchProveedores = useCallback(async () => {
    setLoading(true);
    try {
      const query = search.trim();
      const url = query
        ? `/api/proveedores?search=${encodeURIComponent(query)}`
        : "/api/proveedores";
      const res = await fetch(url);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "No se pudieron cargar proveedores.");
      const list = Array.isArray(data) ? data : [];
      setProveedores(
        list.map((p: Proveedor & { noEmiteFactura?: boolean }) => ({
          ...p,
          noEmiteFactura: Boolean(p.noEmiteFactura),
        }))
      );
    } catch (e) {
      setProveedores([]);
      showToast("error", e instanceof Error ? e.message : "Error al cargar proveedores.");
    } finally {
      setLoading(false);
    }
  }, [showToast, search]);

  useEffect(() => {
    fetchProveedores();
  }, [fetchProveedores]);

  const handleCrear = async () => {
    if (!formAlta.proveedor.trim()) {
      showToast("error", "El campo Proveedor es obligatorio.");
      return;
    }
    setGuardandoAlta(true);
    try {
      const res = await fetch("/api/proveedores", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formAlta),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? "No se pudo crear el proveedor.");
      showToast("ok", "Proveedor creado correctamente.");
      setOpenAlta(false);
      setFormAlta(formVacio);
      fetchProveedores();
    } catch (e) {
      showToast("error", e instanceof Error ? e.message : "Error al crear proveedor.");
    } finally {
      setGuardandoAlta(false);
    }
  };

  const empezarEdicion = (p: Proveedor) => {
    setEditingId(p.id);
    setDraft({
      proveedor: p.proveedor,
      nombreContacto: p.nombreContacto ?? "",
      alias: p.alias ?? "",
      cuit: p.cuit ?? "",
      cuentaDebitoTipoNum: p.cuentaDebitoTipoNum ?? "",
      banco: p.banco ?? "",
      direccion: p.direccion ?? "",
      ciudad: p.ciudad ?? "",
      telefono: p.telefono ?? "",
      email: p.email ?? "",
      formaPago: p.formaPago ?? "",
      cbu: p.cbu ?? "",
      noEmiteFactura: p.noEmiteFactura ?? false,
    });
  };

  const cancelarEdicion = () => {
    setEditingId(null);
    setDraft(null);
  };

  const guardarEdicion = async (id: number) => {
    if (!draft) return;
    if (!draft.proveedor.trim()) {
      showToast("error", "El campo Proveedor es obligatorio.");
      return;
    }
    setSavingInline(true);
    try {
      const res = await fetch(`/api/proveedores/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? "No se pudo actualizar.");
      showToast("ok", "Proveedor actualizado.");
      cancelarEdicion();
      fetchProveedores();
    } catch (e) {
      showToast("error", e instanceof Error ? e.message : "Error al actualizar proveedor.");
    } finally {
      setSavingInline(false);
    }
  };

  const toggleNoEmiteFactura = async (p: Proveedor) => {
    if (editingId === p.id) return;
    const next = !p.noEmiteFactura;
    setProveedores((prev) =>
      prev.map((x) => (x.id === p.id ? { ...x, noEmiteFactura: next } : x))
    );
    setTogglingNoEmiteId(p.id);
    try {
      const res = await fetch(`/api/proveedores/${p.id}/no-emite-factura`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ noEmiteFactura: next }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? "No se pudo actualizar.");
      const serverVal = Boolean(data?.noEmiteFactura);
      setProveedores((prev) =>
        prev.map((x) => (x.id === p.id ? { ...x, noEmiteFactura: serverVal } : x))
      );
      showToast("ok", next ? "Marcado como no emite factura." : "Marcado como emite factura.");
    } catch (e) {
      setProveedores((prev) =>
        prev.map((x) => (x.id === p.id ? { ...x, noEmiteFactura: !next } : x))
      );
      showToast("error", e instanceof Error ? e.message : "Error al actualizar.");
    } finally {
      setTogglingNoEmiteId(null);
    }
  };

  const eliminarProveedor = async (id: number) => {
    if (!confirm("¿Eliminar este proveedor?")) return;
    try {
      const res = await fetch(`/api/proveedores/${id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? "No se pudo eliminar.");
      showToast("ok", "Proveedor eliminado.");
      fetchProveedores();
    } catch (e) {
      showToast("error", e instanceof Error ? e.message : "Error al eliminar proveedor.");
    }
  };

  const toggleSeleccion = (id: number) => {
    if (editingId === id) return;
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const toggleTodos = () => {
    const visiblesSeleccionables = proveedores
      .map((p) => p.id)
      .filter((id) => id !== editingId);
    const todos = visiblesSeleccionables.length > 0 &&
      visiblesSeleccionables.every((id) => selectedIds.includes(id));
    if (todos) {
      setSelectedIds((prev) => prev.filter((id) => !visiblesSeleccionables.includes(id)));
    } else {
      setSelectedIds(visiblesSeleccionables);
    }
  };

  const eliminarSeleccionados = async () => {
    if (selectedIds.length === 0) return;
    setDeletingBulk(true);
    try {
      const res = await fetch("/api/proveedores/bulk-delete", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: selectedIds }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? "No se pudieron eliminar los proveedores.");

      if (editingId != null && selectedIds.includes(editingId)) {
        cancelarEdicion();
      }
      showToast("ok", `Se eliminaron ${Number(data?.eliminados ?? selectedIds.length)} proveedores correctamente`);
      setSelectedIds([]);
      setConfirmBulkOpen(false);
      fetchProveedores();
    } catch (e) {
      showToast("error", e instanceof Error ? e.message : "Error al eliminar proveedores seleccionados.");
    } finally {
      setDeletingBulk(false);
    }
  };

  const exportarExcel = async () => {
    try {
      const res = await fetch("/api/proveedores/export");
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "No se pudieron obtener proveedores.");
      const rows: Proveedor[] = Array.isArray(data) ? data : [];

      const aoa: (string | null)[][] = [
        ["Lista de Proveedores"],
        [
          "Proveedor",
          "Nombre del contacto principal",
          "ALIAS",
          "CUIT",
          "CTA. DE DEBITO (TIPO Y NUMERO)",
          "BANCO",
          "Dirección",
          "Ciudad",
          "Teléfono",
          "Correo electrónico",
          "Formas de Pago",
          "CBU",
        ],
        ...rows.map((r) => [
          r.proveedor ?? "",
          r.nombreContacto ?? "",
          r.alias ?? "",
          r.cuit ?? "",
          r.cuentaDebitoTipoNum ?? "",
          r.banco ?? "",
          r.direccion ?? "",
          r.ciudad ?? "",
          r.telefono ?? "",
          r.email ?? "",
          r.formaPago ?? "",
          r.cbu ?? "",
        ]),
      ];

      const ws = XLSX.utils.aoa_to_sheet(aoa);
      ws["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 11 } }];
      ws["!cols"] = [
        { wch: 25 }, { wch: 28 }, { wch: 18 }, { wch: 16 },
        { wch: 28 }, { wch: 20 }, { wch: 24 }, { wch: 16 },
        { wch: 16 }, { wch: 28 }, { wch: 18 }, { wch: 26 },
      ];
      if (ws["A1"]) {
        ws["A1"].s = {
          font: { bold: true, color: { rgb: "FFFFFF" } },
          fill: { fgColor: { rgb: "2563EB" } },
          alignment: { horizontal: "center", vertical: "center" },
        };
      }

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Proveedores");
      XLSX.writeFile(wb, "BASE_DE_DATOS_DE_PROVEEDORES.xlsx");
      showToast("ok", "Excel exportado correctamente.");
    } catch (e) {
      showToast("error", e instanceof Error ? e.message : "Error al exportar.");
    }
  };

  const mapExcelRowToProveedor = (row: Record<string, unknown>): ProveedorForm => ({
    proveedor: String(row["Proveedor"] ?? "").trim(),
    nombreContacto: String(row["Nombre del contacto principal"] ?? "").trim(),
    alias: String(row["ALIAS"] ?? "").trim(),
    cuit: String(row["CUIT"] ?? "").trim(),
    cuentaDebitoTipoNum: String(row["CTA. DE DEBITO (TIPO Y NUMERO)"] ?? "").trim(),
    banco: String(row["BANCO"] ?? "").trim(),
    direccion: String(row["Dirección"] ?? "").trim(),
    ciudad: String(row["Ciudad"] ?? "").trim(),
    telefono: String(row["Teléfono"] ?? "").trim(),
    email: String(row["Correo electrónico"] ?? "").trim(),
    formaPago: String(row["Formas de Pago"] ?? "").trim() || "TRANSFERENCIA",
    cbu: String(row["CBU"] ?? "").trim(),
    noEmiteFactura: false,
  });

  const checkDuplicados = useCallback(async (rows: ProveedorForm[]) => {
    const payload = {
      proveedores: rows.map((r) => ({
        proveedor: r.proveedor,
        cuit: r.cuit || "",
      })),
    };
    const res = await fetch("/api/proveedores/check-duplicates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error ?? "No se pudo verificar duplicados.");
    return (Array.isArray(data) ? data : []) as DuplicateCheckResult[];
  }, []);

  const parseBulkFile = async (file: File) => {
    const buffer = await file.arrayBuffer();
    const wb = XLSX.read(buffer, { type: "array" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" }) as unknown[][];
    if (raw.length === 0) {
      setBulkRows([]);
      setBulkInfo("No se encontraron filas.");
      return;
    }

    const firstRowText = raw[0].map((c) => String(c ?? "").trim().toLowerCase()).join(" ");
    const headerIndex = firstRowText.includes("lista de proveedores") ? 1 : 0;
    const header = (raw[headerIndex] ?? []).map((h) => String(h ?? "").trim());
    const body = raw.slice(headerIndex + 1);

    const rowsParsed = body
      .map((r) => {
        const obj: Record<string, unknown> = {};
        header.forEach((h, i) => {
          obj[h] = r[i] ?? "";
        });
        return obj;
      })
      .filter((r) => {
        const proveedor = String(r["Proveedor"] ?? "").trim();
        return proveedor !== "" && proveedor.toLowerCase() !== "proveedor";
      });

    if (rowsParsed.length === 0) {
      setBulkRows([]);
      setBulkInfo("No hay registros válidos para importar.");
      return;
    }

    const mapped = rowsParsed.map(mapExcelRowToProveedor);
    setBulkChecking(true);
    setBulkInfo("Verificando duplicados...");
    try {
      const dup = await checkDuplicados(mapped);
      const merged: BulkProveedorRow[] = mapped.map((r, i) => ({
        ...r,
        isDuplicate: Boolean(dup[i]?.isDuplicate),
        motivo: dup[i]?.motivo ?? null,
      }));
      setBulkRows(merged);
      setIncludeDuplicates(false);
      setBulkInfo(`Se encontraron ${merged.length} registros para importar`);
    } finally {
      setBulkChecking(false);
    }
  };

  const onBulkFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      await parseBulkFile(file);
      setBulkResult(null);
    } catch {
      setBulkInfo("No se pudo leer el archivo.");
      setBulkRows([]);
    }
  };

  const confirmarImportacionBulk = async () => {
    if (rowsParaImportar.length === 0) {
      showToast("warning", "No hay filas para importar.");
      return;
    }
    setBulkLoading(true);
    try {
      const res = await fetch("/api/proveedores/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: rowsParaImportar, overwrite: includeDuplicates }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Error en importación.");
      setBulkResult({
        insertados: Number(data?.insertados ?? 0),
        actualizados: Number(data?.actualizados ?? 0),
        errores: Array.isArray(data?.errores) ? data.errores : [],
      });
      const insertados = Number(data?.insertados ?? 0);
      const actualizados = Number(data?.actualizados ?? 0);
      showToast("ok", `Se importaron ${insertados + actualizados} proveedores (${insertados} nuevos, ${actualizados} actualizados)`);
      fetchProveedores();
    } catch (e) {
      showToast("error", e instanceof Error ? e.message : "Error al importar.");
    } finally {
      setBulkLoading(false);
    }
  };

  const totalRows = bulkRows.length;
  const totalDuplicados = bulkRows.filter((r) => r.isDuplicate).length;
  const totalNuevos = totalRows - totalDuplicados;
  const rowsParaImportar = includeDuplicates
    ? bulkRows
    : bulkRows.filter((r) => !r.isDuplicate);

  return (
    <div className="space-y-6 mt-6">
      {toast && (
        <div
          className={`rounded-lg border px-4 py-3 text-sm ${
            toast.tipo === "ok"
              ? "border-green-200 bg-green-50 text-green-800"
              : toast.tipo === "warning"
                ? "border-amber-200 bg-amber-50 text-amber-800"
                : "border-red-200 bg-red-50 text-red-800"
          }`}
        >
          {toast.text}
        </div>
      )}

      <div ref={selectionZoneRef} className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center">
        <Button className="bg-blue-600 hover:bg-blue-700 text-white" onClick={() => setOpenAlta(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Agregar Proveedor
        </Button>
        <Button variant="outline" onClick={() => setOpenBulk(true)}>
          <Upload className="h-4 w-4 mr-2" />
          Carga Masiva
        </Button>
        <Button variant="outline" onClick={exportarExcel}>
          <FileSpreadsheet className="h-4 w-4 mr-2" />
          Exportar
        </Button>
        <div
          className={`transition-all duration-200 overflow-hidden ${
            selectedIds.length > 0 ? "opacity-100 max-w-[320px]" : "opacity-0 max-w-0"
          }`}
        >
          {selectedIds.length > 0 && (
            <Button
              className="bg-red-500 hover:bg-red-600 text-white whitespace-nowrap"
              onClick={() => setConfirmBulkOpen(true)}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Eliminar seleccionados ({selectedIds.length})
            </Button>
          )}
        </div>
      </div>
      <div className="relative max-w-md">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por proveedor, CUIT, CBU, banco, contacto o email..."
          className="pl-9"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Listado de Proveedores</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto border rounded-lg">
            <table className="w-full text-sm min-w-[1100px]">
              <thead>
                <tr className="border-b bg-gray-50 text-left text-gray-600">
                  <th className="px-3 py-2 w-10">
                    <input
                      ref={headerCheckboxRef}
                      type="checkbox"
                      onChange={toggleTodos}
                      className="w-4 h-4 accent-red-500 cursor-pointer"
                    />
                  </th>
                  <th className="px-3 py-2">Proveedor</th>
                  <th className="px-3 py-2">Contacto</th>
                  <th className="px-3 py-2">CUIT</th>
                  <th className="px-3 py-2">Banco</th>
                  <th className="px-3 py-2">CBU</th>
                  <th className="px-3 py-2">Teléfono</th>
                  <th className="px-3 py-2">Email</th>
                  <th className="px-3 py-2 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={9} className="px-3 py-8 text-center text-gray-500">Cargando...</td>
                  </tr>
                ) : proveedores.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-3 py-8 text-center text-gray-500">No hay proveedores registrados.</td>
                  </tr>
                ) : (
                  proveedores.map((p) => {
                    const edit = editingId === p.id;
                    return (
                      <tr
                        key={p.id}
                        className={`border-b hover:bg-gray-50 ${selectedIds.includes(p.id) ? "bg-red-50" : ""}`}
                      >
                        <td className="px-3 py-2">
                          <input
                            type="checkbox"
                            checked={selectedIds.includes(p.id)}
                            onChange={() => toggleSeleccion(p.id)}
                            disabled={editingId === p.id}
                            className="w-4 h-4 accent-red-500 cursor-pointer disabled:opacity-40"
                          />
                        </td>
                        <td className="px-3 py-2">
                          {edit ? (
                            <Input
                              value={draft?.proveedor ?? ""}
                              onChange={(e) => setDraft((d) => (d ? { ...d, proveedor: e.target.value } : d))}
                            />
                          ) : (
                            <span className="inline-flex flex-wrap items-center gap-2">
                              <span>{p.proveedor}</span>
                              {p.noEmiteFactura && (
                                <span className="inline-flex rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-800">
                                  Sin factura
                                </span>
                              )}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          {edit ? (
                            <Input
                              value={draft?.nombreContacto ?? ""}
                              onChange={(e) => setDraft((d) => (d ? { ...d, nombreContacto: e.target.value } : d))}
                            />
                          ) : p.nombreContacto ?? "—"}
                        </td>
                        <td className="px-3 py-2">
                          {edit ? (
                            <Input
                              value={draft?.cuit ?? ""}
                              onChange={(e) => setDraft((d) => (d ? { ...d, cuit: e.target.value } : d))}
                            />
                          ) : p.cuit ?? "—"}
                        </td>
                        <td className="px-3 py-2">
                          {edit ? (
                            <Input
                              value={draft?.banco ?? ""}
                              onChange={(e) => setDraft((d) => (d ? { ...d, banco: e.target.value } : d))}
                            />
                          ) : p.banco ?? "—"}
                        </td>
                        <td className="px-3 py-2">
                          {edit ? (
                            <Input
                              value={draft?.cbu ?? ""}
                              onChange={(e) => setDraft((d) => (d ? { ...d, cbu: e.target.value } : d))}
                            />
                          ) : p.cbu ?? "—"}
                        </td>
                        <td className="px-3 py-2">
                          {edit ? (
                            <Input
                              value={draft?.telefono ?? ""}
                              onChange={(e) => setDraft((d) => (d ? { ...d, telefono: e.target.value } : d))}
                            />
                          ) : p.telefono ?? "—"}
                        </td>
                        <td className="px-3 py-2">
                          {edit ? (
                            <Input
                              type="email"
                              value={draft?.email ?? ""}
                              onChange={(e) => setDraft((d) => (d ? { ...d, email: e.target.value } : d))}
                            />
                          ) : p.email ?? "—"}
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex items-center justify-end gap-1">
                            {!edit && (
                              <Button
                                type="button"
                                size="icon"
                                variant="ghost"
                                className={`h-8 w-8 ${
                                  p.noEmiteFactura
                                    ? "text-amber-500 hover:bg-amber-50"
                                    : "text-gray-400 hover:bg-gray-100"
                                }`}
                                onClick={() => void toggleNoEmiteFactura(p)}
                                disabled={togglingNoEmiteId === p.id}
                                title={p.noEmiteFactura ? "No emite factura" : "Emite factura"}
                              >
                                {p.noEmiteFactura ? (
                                  <FileX className="h-4 w-4" />
                                ) : (
                                  <FileText className="h-4 w-4" />
                                )}
                              </Button>
                            )}
                            {!edit ? (
                              <Button
                                type="button"
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8"
                                onClick={() => empezarEdicion(p)}
                                title="Editar"
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                            ) : (
                              <>
                                <Button
                                  type="button"
                                  size="icon"
                                  variant="ghost"
                                  className="h-8 w-8 text-green-700 hover:bg-green-50"
                                  onClick={() => void guardarEdicion(p.id)}
                                  disabled={savingInline}
                                  title="Guardar"
                                >
                                  <Check className="h-4 w-4" />
                                </Button>
                                <Button
                                  type="button"
                                  size="icon"
                                  variant="ghost"
                                  className="h-8 w-8"
                                  onClick={cancelarEdicion}
                                  disabled={savingInline}
                                  title="Cancelar"
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </>
                            )}
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 text-red-700 hover:bg-red-50"
                              onClick={() => void eliminarProveedor(p.id)}
                              title="Eliminar"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
      </div>

      <Dialog open={openAlta} onOpenChange={setOpenAlta}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Agregar Proveedor</DialogTitle>
            <DialogDescription>Completá los datos del proveedor.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-2">
            <div className="space-y-2">
              <Label>Proveedor *</Label>
              <Input value={formAlta.proveedor} onChange={(e) => setFormAlta((f) => ({ ...f, proveedor: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Nombre del contacto principal</Label>
              <Input value={formAlta.nombreContacto ?? ""} onChange={(e) => setFormAlta((f) => ({ ...f, nombreContacto: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Alias</Label>
              <Input value={formAlta.alias ?? ""} onChange={(e) => setFormAlta((f) => ({ ...f, alias: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>CUIT</Label>
              <Input value={formAlta.cuit ?? ""} onChange={(e) => setFormAlta((f) => ({ ...f, cuit: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Cta. de Débito (Tipo y Número)</Label>
              <Input value={formAlta.cuentaDebitoTipoNum ?? ""} onChange={(e) => setFormAlta((f) => ({ ...f, cuentaDebitoTipoNum: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Banco</Label>
              <Input value={formAlta.banco ?? ""} onChange={(e) => setFormAlta((f) => ({ ...f, banco: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Dirección</Label>
              <Input value={formAlta.direccion ?? ""} onChange={(e) => setFormAlta((f) => ({ ...f, direccion: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Ciudad</Label>
              <Input value={formAlta.ciudad ?? ""} onChange={(e) => setFormAlta((f) => ({ ...f, ciudad: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Teléfono</Label>
              <Input value={formAlta.telefono ?? ""} onChange={(e) => setFormAlta((f) => ({ ...f, telefono: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Correo electrónico</Label>
              <Input type="email" value={formAlta.email ?? ""} onChange={(e) => setFormAlta((f) => ({ ...f, email: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Forma de Pago</Label>
              <select
                value={formAlta.formaPago ?? ""}
                onChange={(e) => setFormAlta((f) => ({ ...f, formaPago: e.target.value }))}
                className="h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
              >
                <option value="">Seleccionar...</option>
                <option value="TRANSFERENCIA">TRANSFERENCIA</option>
                <option value="CHEQUE">CHEQUE</option>
                <option value="EFECTIVO">EFECTIVO</option>
                <option value="OTRO">OTRO</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label>CBU</Label>
              <Input value={formAlta.cbu ?? ""} onChange={(e) => setFormAlta((f) => ({ ...f, cbu: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenAlta(false)}>
              Cancelar
            </Button>
            <Button onClick={() => void handleCrear()} disabled={guardandoAlta}>
              {guardandoAlta ? "Guardando..." : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={openBulk} onOpenChange={setOpenBulk}>
        <DialogContent className="w-[95vw] max-w-[95vw] h-[92vh] max-h-[92vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Carga Masiva de Proveedores</DialogTitle>
            <DialogDescription>Subí un archivo .xlsx o .xls para importar proveedores.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 overflow-y-auto flex-1 min-h-0 pr-1">
            <Input type="file" accept=".xlsx,.xls" onChange={(e) => void onBulkFileChange(e)} />
            {bulkInfo && <p className="text-sm text-gray-700">{bulkInfo}</p>}
            {bulkChecking && <p className="text-sm text-blue-700">Verificando duplicados...</p>}

            {bulkRows.length > 0 && (
              <>
              <div className="flex flex-wrap gap-2 text-xs">
                <span className="rounded-full border border-green-200 bg-green-50 text-green-700 px-3 py-1">
                  {totalNuevos} registros nuevos
                </span>
                {totalDuplicados > 0 && (
                  <span className="rounded-full border border-yellow-300 bg-yellow-50 text-yellow-800 px-3 py-1">
                    {totalDuplicados} duplicados
                  </span>
                )}
                <span className="rounded-full border border-gray-200 bg-gray-50 text-gray-700 px-3 py-1">
                  Total: {totalRows} registros encontrados en el archivo
                </span>
              </div>
              <div className="space-y-2 text-sm">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={!includeDuplicates}
                    onChange={(e) => setIncludeDuplicates(!e.target.checked)}
                    className="w-4 h-4"
                  />
                  Importar solo registros nuevos
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={includeDuplicates}
                    onChange={(e) => setIncludeDuplicates(e.target.checked)}
                    className="w-4 h-4"
                  />
                  Importar también duplicados (sobreescribir)
                </label>
              </div>
              <div className="border rounded-lg overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-gray-50 border-b">
                      <th className="px-2 py-2 text-left">Proveedor</th>
                      <th className="px-2 py-2 text-left">CUIT</th>
                      <th className="px-2 py-2 text-left">Banco</th>
                      <th className="px-2 py-2 text-left">CBU</th>
                      <th className="px-2 py-2 text-left">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bulkRows.map((row, idx) => (
                      <tr key={idx} className={`border-b ${row.isDuplicate ? "bg-yellow-50" : ""}`}>
                        <td className="px-2 py-2">{row.proveedor || "—"}</td>
                        <td className="px-2 py-2">{row.cuit || "—"}</td>
                        <td className="px-2 py-2">{row.banco || "—"}</td>
                        <td className="px-2 py-2">{row.cbu || "—"}</td>
                        <td className="px-2 py-2">
                          {row.isDuplicate ? (
                            <span
                              className="inline-flex rounded-full border border-yellow-300 bg-yellow-100 text-yellow-800 px-2 py-0.5"
                              title={row.motivo ?? "Duplicado"}
                            >
                              ⚠ Duplicado
                            </span>
                          ) : (
                            <span className="inline-flex rounded-full border border-green-300 bg-green-100 text-green-800 px-2 py-0.5">
                              Nuevo
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              </>
            )}

            {bulkResult && (
              <div className="space-y-2 text-sm">
                <p className="text-green-700 font-medium">
                  Se importaron {bulkResult.insertados + bulkResult.actualizados} proveedores ({bulkResult.insertados} nuevos, {bulkResult.actualizados} actualizados).
                </p>
                {bulkResult.errores.length > 0 && (
                  <ul className="list-disc pl-6 text-amber-700">
                    {bulkResult.errores.map((err, i) => (
                      <li key={`${err}-${i}`}>{err}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenBulk(false)}>
              Cerrar
            </Button>
            <Button
              onClick={() => void confirmarImportacionBulk()}
              disabled={bulkLoading || rowsParaImportar.length === 0 || bulkChecking}
            >
              {bulkLoading ? "Importando..." : `Importar ${rowsParaImportar.length} registros`}
            </Button>
          </DialogFooter>
          {!includeDuplicates && totalRows > 0 && rowsParaImportar.length === 0 && (
            <p className="text-sm text-amber-700">
              Todos los registros del archivo ya existen en el sistema
            </p>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={confirmBulkOpen} onOpenChange={setConfirmBulkOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Eliminar proveedores seleccionados</DialogTitle>
            <DialogDescription>
              ¿Estás seguro que querés eliminar {selectedIds.length} proveedor(es) seleccionado(s)?
              Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmBulkOpen(false)} disabled={deletingBulk}>
              Cancelar
            </Button>
            <Button
              className="bg-red-500 hover:bg-red-600 text-white"
              onClick={() => void eliminarSeleccionados()}
              disabled={deletingBulk}
            >
              {deletingBulk ? "Eliminando..." : "Eliminar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
