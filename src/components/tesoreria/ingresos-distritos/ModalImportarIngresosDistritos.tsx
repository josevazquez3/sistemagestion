"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { parsearConceptoIngresoDistrito } from "@/lib/tesoreria/parsearConceptoIngresoDistrito";
import { formatearImporteAR } from "@/lib/parsearExtracto";
import * as XLSX from "xlsx";

export type FilaImportacion = {
  fecha: string;
  recibo: string;
  distrito: string;
  concepto: string;
  importe: number;
  ctaColeg: number | null;
  nMatriculados: number | null;
};

function parseNumeroCelda(val: unknown): number | null {
  if (val == null) return null;
  if (typeof val === "number" && !Number.isNaN(val)) return val;
  const str = String(val).replace(/\s/g, "").replace(/\./g, "").replace(",", ".");
  const n = parseFloat(str);
  return Number.isNaN(n) ? null : n;
}

function parseFechaCelda(val: unknown): string {
  if (val == null) return "";
  if (typeof val === "string" && /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(val.trim())) return val.trim();
  if (typeof val === "number") {
    const d = new Date((val - 25569) * 86400 * 1000);
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yyyy = d.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  }
  const str = String(val).trim();
  return str;
}

/** Parsea filas de Excel a FilaImportacion; aplica parseo de CONCEPTO si hace falta */
function parsearFilasExcel(filas: unknown[][]): FilaImportacion[] {
  if (filas.length < 2) return [];
  const headers = (filas[0] as unknown[]).map((h) => String(h ?? "").toLowerCase());
  const idxFecha = headers.findIndex((h) => h.includes("fecha"));
  const idxRecibo = headers.findIndex((h) => h.includes("recibo"));
  const idxDistrito = headers.findIndex((h) => h.includes("distrito"));
  const idxConcepto = headers.findIndex((h) => h.includes("concepto"));
  const idxCtaColeg = headers.findIndex((h) => h.includes("cta") && h.includes("coleg"));
  const idxNMat = headers.findIndex((h) => h.includes("matriculados") || h.includes("n. mat"));
  const idxImporte = headers.findIndex((h) => h.includes("importe"));
  if (idxConcepto < 0 || idxImporte < 0) return [];

  const result: FilaImportacion[] = [];
  for (let i = 1; i < filas.length; i++) {
    const row = filas[i] as unknown[];
    const concepto = (row[idxConcepto] != null ? String(row[idxConcepto]) : "").trim();
    const importeRaw = parseNumeroCelda(row[idxImporte]);
    const importe = importeRaw ?? 0;
    if (!concepto && importe === 0) continue;

    const fecha = idxFecha >= 0 ? parseFechaCelda(row[idxFecha]) : "";
    const recibo = idxRecibo >= 0 ? String(row[idxRecibo] ?? "").trim() : "";
    const distrito = idxDistrito >= 0 ? String(row[idxDistrito] ?? "").trim() : "";
    let ctaColeg: number | null = idxCtaColeg >= 0 ? parseNumeroCelda(row[idxCtaColeg]) : null;
    let nMatriculados: number | null = idxNMat >= 0 ? parseNumeroCelda(row[idxNMat]) : null;
    if (ctaColeg === null && nMatriculados === null) {
      const parsed = parsearConceptoIngresoDistrito(concepto, importe);
      ctaColeg = parsed.ctaColeg;
      nMatriculados = parsed.nMatriculados;
    }

    result.push({
      fecha,
      recibo,
      distrito,
      concepto,
      importe,
      ctaColeg,
      nMatriculados,
    });
  }
  return result;
}

type ModalImportarIngresosDistritosProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mes: number;
  anio: number;
  codigos: string[];
  onSuccess: () => void;
  showMessage: (tipo: "ok" | "error", text: string) => void;
};

export function ModalImportarIngresosDistritos({
  open,
  onOpenChange,
  mes,
  anio,
  codigos,
  onSuccess,
  showMessage,
}: ModalImportarIngresosDistritosProps) {
  const [preview, setPreview] = useState<FilaImportacion[]>([]);
  const [importando, setImportando] = useState(false);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (ext !== "xls" && ext !== "xlsx") {
      showMessage("error", "Solo se permiten archivos .xls o .xlsx.");
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const buffer = ev.target?.result as ArrayBuffer;
        const wb = XLSX.read(buffer, { type: "array", cellDates: false });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const filas: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
        const parsed = parsearFilasExcel(filas);
        setPreview(parsed);
        if (parsed.length === 0) {
          showMessage("error", "No se encontraron filas válidas. Revisá que haya columnas Concepto e Importe.");
        }
      } catch (err) {
        console.error(err);
        showMessage("error", "Error al leer el archivo.");
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const confirmarImportacion = async () => {
    if (preview.length === 0) return;
    if (codigos.length === 0) {
      showMessage("error", "Agregá al menos un código en la configuración del período.");
      return;
    }
    setImportando(true);
    let importados = 0;
    for (const f of preview) {
      try {
        const [d, m, y] = f.fecha.split("/");
        const fechaIso = d && m && y
          ? `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}T12:00:00.000-03:00`
          : new Date().toISOString();
        const res = await fetch("/api/tesoreria/ingresos-distritos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mes,
            anio,
            codigos,
            fecha: fechaIso,
            recibo: f.recibo || null,
            distrito: f.distrito || null,
            concepto: f.concepto,
            ctaColeg: f.ctaColeg,
            nMatriculados: f.nMatriculados,
            importe: f.importe,
          }),
        });
        if (res.ok) importados++;
      } catch {
        // skip
      }
    }
    setImportando(false);
    setPreview([]);
    onOpenChange(false);
    showMessage("ok", `Se importaron ${importados} registro(s).`);
    onSuccess();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Importar desde Excel</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
          <div>
            <input
              type="file"
              accept=".xls,.xlsx"
              onChange={handleFile}
              className="text-sm"
            />
          </div>
          {preview.length > 0 && (
            <>
              <p className="text-sm text-gray-600">
                {preview.length} fila(s) detectadas. Revisá antes de confirmar.
              </p>
              <div className="overflow-auto border rounded flex-1 min-h-[200px]">
                <table className="w-full text-sm border-collapse">
                  <thead className="sticky top-0 bg-white">
                    <tr className="border-b text-left text-gray-600">
                      <th className="p-2">Fecha</th>
                      <th className="p-2">Recibo</th>
                      <th className="p-2">Distrito</th>
                      <th className="p-2">Concepto</th>
                      <th className="p-2 text-right">Cta. Coleg.</th>
                      <th className="p-2 text-right">N. Mat.</th>
                      <th className="p-2 text-right">Importe</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((f, i) => (
                      <tr key={i} className="border-b hover:bg-gray-50">
                        <td className="p-2">{f.fecha}</td>
                        <td className="p-2">{f.recibo}</td>
                        <td className="p-2">{f.distrito}</td>
                        <td className="p-2 max-w-[200px] truncate" title={f.concepto}>{f.concepto}</td>
                        <td className="p-2 text-right">{f.ctaColeg != null ? formatearImporteAR(f.ctaColeg) : "—"}</td>
                        <td className="p-2 text-right">{f.nMatriculados != null ? formatearImporteAR(f.nMatriculados) : "—"}</td>
                        <td className="p-2 text-right font-medium">{formatearImporteAR(f.importe)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={confirmarImportacion}
            disabled={preview.length === 0 || importando}
          >
            {importando ? "Importando…" : `Confirmar importación (${preview.length})`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
