"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { FilePlus, FolderUp, Search, Pencil, Trash2, Loader2, FileDown } from "lucide-react";
import { ModalCuenta, type CuentaBancaria } from "./ModalCuenta";
import { ImportarCuentas } from "./ImportarCuentas";
import * as XLSX from "xlsx";

const PER_PAGE = 20;

export function CuentasBancariasContent() {
  const [data, setData] = useState<CuentaBancaria[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [searchDebounced, setSearchDebounced] = useState("");
  const [mensaje, setMensaje] = useState<{ tipo: "ok" | "error"; text: string } | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalImportarOpen, setModalImportarOpen] = useState(false);
  const [cuentaEditar, setCuentaEditar] = useState<CuentaBancaria | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setSearchDebounced(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const fetchCuentas = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("perPage", String(PER_PAGE));
      if (searchDebounced) params.set("q", searchDebounced);
      const res = await fetch(`/api/tesoreria/cuentas-bancarias?${params}`);
      const json = await res.json();
      if (res.ok) {
        setData(json.data ?? []);
        setTotal(json.total ?? 0);
      }
    } finally {
      setLoading(false);
    }
  }, [page, searchDebounced]);

  useEffect(() => {
    fetchCuentas();
  }, [fetchCuentas]);

  useEffect(() => {
    if (!mensaje) return;
    const t = setTimeout(() => setMensaje(null), 4000);
    return () => clearTimeout(t);
  }, [mensaje]);

  const showMessage = useCallback((tipo: "ok" | "error", text: string) => {
    setMensaje({ tipo, text });
  }, []);

  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));

  const handleNueva = () => {
    setCuentaEditar(null);
    setModalOpen(true);
  };

  const handleEditar = (c: CuentaBancaria) => {
    setCuentaEditar(c);
    setModalOpen(true);
  };

  const handleDelete = (c: CuentaBancaria) => {
    if (!confirm("¿Eliminar esta cuenta?")) return;
    fetch(`/api/tesoreria/cuentas-bancarias/${c.id}`, { method: "DELETE" })
      .then(async (res) => {
        const data = await res.json();
        if (res.ok) {
          showMessage("ok", "Cuenta eliminada.");
          fetchCuentas();
        } else {
          showMessage("error", data.error || "Error al eliminar");
        }
      })
      .catch(() => showMessage("error", "Error de conexión"));
  };

  const exportarExcel = () => {
    const ws = XLSX.utils.json_to_sheet(
      data.map((c) => ({
        Código: c.codigo,
        "Cód. operativo": c.codOperativo ?? "",
        Nombre: c.nombre,
      }))
    );
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Cuentas");
    XLSX.writeFile(wb, "cuentas_bancarias.xlsx");
  };

  return (
    <div className="space-y-6 mt-6">
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
        <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-4">
          <CardTitle>Cuentas</CardTitle>
          <div className="flex flex-wrap gap-2 items-center">
            <div className="relative min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Buscar por código o nombre..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Button size="sm" variant="outline" onClick={() => setModalImportarOpen(true)}>
              <FolderUp className="h-4 w-4 mr-1" />
              Importar
            </Button>
            <Button size="sm" variant="outline" onClick={exportarExcel} disabled={data.length === 0}>
              <FileDown className="h-4 w-4 mr-1" />
              Exportar Excel
            </Button>
            <Button size="sm" className="bg-[#4CAF50] hover:bg-[#388E3C]" onClick={handleNueva}>
              <FilePlus className="h-4 w-4 mr-1" />
              Nueva Cuenta
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Cód. operativo</TableHead>
                  <TableHead>Nombre de la cuenta</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto text-gray-400" />
                    </TableCell>
                  </TableRow>
                ) : data.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-gray-500">
                      No hay cuentas.
                    </TableCell>
                  </TableRow>
                ) : (
                  data.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.codigo}</TableCell>
                      <TableCell>{c.codOperativo ?? "—"}</TableCell>
                      <TableCell>{c.nombre}</TableCell>
                      <TableCell>{c.activo ? "Activa" : "Inactiva"}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center gap-2 justify-end">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0"
                            onClick={() => handleEditar(c)}
                            title="Editar"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                            onClick={() => handleDelete(c)}
                            title="Eliminar"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-600">
                Página {page} de {totalPages} ({total} cuentas)
              </p>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                  Anterior
                </Button>
                <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                  Siguiente
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <ModalCuenta
        open={modalOpen}
        onOpenChange={setModalOpen}
        cuenta={cuentaEditar}
        onSuccess={fetchCuentas}
        showMessage={showMessage}
      />
      <ImportarCuentas
        open={modalImportarOpen}
        onOpenChange={setModalImportarOpen}
        onSuccess={fetchCuentas}
        showMessage={showMessage}
      />
    </div>
  );
}
