"use client";

import { useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";
import { ArrowLeft, FileText, Pencil, RefreshCw, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { ModalNuevoTema, type InitialTemaModal } from "@/components/secretaria/temas/ModalNuevoTema";

export type ReporteTemaRow = {
  temaId: number;
  temaNumero: number;
  tema: string;
  fechaOD: string | null; // DD/MM/YYYY
  guiaMesa: string | null; // DD/MM/YYYY
  cantOD: number;
  cantGuia: number;
  eliminado?: boolean;
};

type Props = {
  rows: ReporteTemaRow[];
};

export function ReporteTemasTable({ rows }: Props) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [editInitial, setEditInitial] = useState<InitialTemaModal | null>(null);
  const [loadingEdit, setLoadingEdit] = useState(false);

  const exportRows = useMemo(() => {
    return rows.map((r, i) => [
      i + 1,
      r.tema,
      r.fechaOD ?? "—",
      r.guiaMesa ?? "—",
      r.cantOD,
      r.cantGuia,
    ]);
  }, [rows]);

  const exportar = () => {
    const aoa = [
      ["#", "Tema", "Fecha OD", "Guia Mesa", "Cant. OD", "Cant. Guía"],
      ...exportRows,
    ];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Reporte");
    XLSX.writeFile(wb, "reporte-temas.xlsx");
  };

  const abrirEditar = async (temaId: number) => {
    setLoadingEdit(true);
    try {
      // Reutiliza el mismo modal/flujo de edición que Temas.
      const res = await fetch("/api/secretaria/temas");
      const data = await res.json().catch(() => []);
      if (!res.ok) throw new Error(data?.error || "No se pudo cargar el tema.");
      const tema = (Array.isArray(data) ? data : []).find((t: any) => t?.id === temaId);
      if (!tema) throw new Error("Tema no encontrado.");
      setEditInitial({
        fecha: tema.fecha ? new Date(tema.fecha).toLocaleDateString("es-AR", { timeZone: "UTC" }) : "",
        tema: tema.tema ?? "",
        observacion: tema.observacion ?? null,
        temaId: tema.id,
        usos: tema.usos ?? [],
      });
      setEditOpen(true);
    } finally {
      setLoadingEdit(false);
    }
  };

  const borrar = async (temaId: number) => {
    if (!confirm("¿Eliminar tema?")) return;
    const res = await fetch(`/api/secretaria/temas/${temaId}?force=true`, { method: "DELETE" });
    if (!res.ok) {
      return;
    }
    router.refresh();
  };

  return (
    <div className="space-y-4 mt-6">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold text-gray-800">Reporte Temas</h1>
          <p className="text-gray-500 mt-1">Vista previa y exportación a Excel.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" onClick={() => router.back()}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Volver
          </Button>
          <Button type="button" variant="outline" onClick={() => router.refresh()}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Actualizar
          </Button>
          <Button type="button" variant="outline" onClick={exportar}>
            <FileText className="w-4 h-4 mr-2" />
            Exportar
          </Button>
        </div>
      </div>

      <div className="border rounded-lg overflow-x-auto bg-white">
        <table className="w-full text-sm min-w-[1060px]">
          <thead>
            <tr className="border-b bg-[#E8F5E9] text-[#388E3C]">
              <th className="p-2 pl-3 w-16 text-left">#</th>
              <th className="p-2 text-left">Tema</th>
              <th className="p-2 w-28 text-left">Fecha OD</th>
              <th className="p-2 w-28 text-left">Guia Mesa</th>
              <th className="p-2 w-24 text-right">Cant. OD</th>
              <th className="p-2 w-24 text-right pr-3">Cant. Guía</th>
              <th className="p-2 w-28 text-left">Estado</th>
              <th className="p-2 w-44 text-right pr-3">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td className="p-6 text-center text-muted-foreground" colSpan={8}>
                  No hay temas.
                </td>
              </tr>
            ) : (
              rows.map((r, i) => (
                <tr key={`${r.temaNumero}-${i}`} className="border-b last:border-b-0 odd:bg-muted/10">
                  <td className="p-2 pl-3">{i + 1}</td>
                  <td className="p-2">{r.tema}</td>
                  <td className="p-2">{r.fechaOD ?? "—"}</td>
                  <td className="p-2">{r.guiaMesa ?? "—"}</td>
                  <td className="p-2 text-right">{r.cantOD}</td>
                  <td className="p-2 text-right pr-3">{r.cantGuia}</td>
                  <td className="p-2">
                    {r.eliminado ? (
                      <span className="inline-block text-xs rounded-full px-2 py-0.5 bg-gray-200 text-gray-800">
                        Eliminado
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="p-2 pr-3 text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={loadingEdit}
                        onClick={() => void abrirEditar(r.temaId)}
                      >
                        <Pencil className="w-4 h-4 mr-1" />
                        Editar
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="destructive"
                        onClick={() => void borrar(r.temaId)}
                      >
                        <Trash2 className="w-4 h-4 mr-1" />
                        Borrar
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <ModalNuevoTema
        open={editOpen}
        onOpenChange={(o) => {
          setEditOpen(o);
          if (!o) setEditInitial(null);
        }}
        userName=""
        initial={editInitial}
        refetch={async () => {
          router.refresh();
        }}
        onEditarExito={() => {
          // La página se refresca arriba
        }}
        onError={() => {
          // Mantener consistente: sin toasts nuevos acá
        }}
        onGuardar={async () => {
          // No se usa en modo edición
        }}
      />
    </div>
  );
}

