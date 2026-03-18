"use client";

import { useState, useEffect, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InputFecha } from "@/components/ui/InputFecha";
import { Label } from "@/components/ui/label";
import { formatearImporteAR } from "@/lib/parsearExtracto";
import * as XLSX from "xlsx";

const TZ = "America/Argentina/Buenos_Aires";
const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

function formatFechaDDMMYYYY(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("es-AR", {
      timeZone: TZ,
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return iso.slice(0, 10);
  }
}

function parseFechaToDate(str: string): Date | null {
  const [d, m, y] = str.trim().split("/");
  if (!d || !m || !y) return null;
  const day = parseInt(d, 10);
  const month = parseInt(m, 10) - 1;
  const year = parseInt(y, 10);
  if (month < 0 || month > 11 || day < 1 || day > 31) return null;
  return new Date(year, month, day, 0, 0, 0, 0);
}

export type MovimientoCobroCertificacion = {
  id: string;
  fecha: string;
  concepto: string;
  importe: number;
  saldo: number;
  mes: number;
  anio: number;
};

type LegajoOption = { id: string; numeroLegajo: number; nombre: string };
type LegajoSeleccionado = { legajoId: string; nombre: string; monto: number };

type MovimientoRango = {
  fecha: string;
  concepto: string;
  importe: number;
  saldo: number;
};

type ModalComisionesProps = {
  isOpen: boolean;
  onClose: () => void;
  mes: number;
  anio: number;
  movimientos: MovimientoCobroCertificacion[];
  showMessage: (tipo: "ok" | "error", text: string) => void;
};

export function ModalComisiones({
  isOpen,
  onClose,
  mes,
  anio,
  movimientos: _movimientos, // TODO: verificar si sigue siendo necesario; actualmente no se usa
  showMessage,
}: ModalComisionesProps) {
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [saldoPeriodo, setSaldoPeriodo] = useState<number | null>(null);
  const [loadingSaldo, setLoadingSaldo] = useState(false);
  const [porcentaje, setPorcentaje] = useState("");
  const [legajos, setLegajos] = useState<LegajoSeleccionado[]>([]);
  const [busquedaLegajo, setBusquedaLegajo] = useState("");
  const [legajoOptions, setLegajoOptions] = useState<LegajoOption[]>([]);
  const [legajoDropdownOpen, setLegajoDropdownOpen] = useState(false);
  const [loadingLegajos, setLoadingLegajos] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const legajoDropdownRef = useRef<HTMLDivElement>(null);
  const [movimientosRango, setMovimientosRango] = useState<MovimientoRango[]>([]);

  const totalComision =
    saldoPeriodo != null && porcentaje !== ""
      ? (saldoPeriodo * parseFloat(porcentaje.replace(",", "."))) / 100
      : 0;
  const montoPorLegajo =
    legajos.length > 0 ? Math.round((totalComision / legajos.length) * 100) / 100 : 0;

  useEffect(() => {
    if (!isOpen) return;
    const d = parseFechaToDate(desde);
    const h = parseFechaToDate(hasta);
    if (!d || !h || d > h) {
      setSaldoPeriodo(null);
      return;
    }
    setLoadingSaldo(true);
    const params = new URLSearchParams({
      desde,
      hasta,
      mes: String(mes),
      anio: String(anio),
    });
    fetch(`/api/tesoreria/cobro-certificaciones/saldo-periodo?${params}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.saldoTotal != null) {
          setSaldoPeriodo(data.saldoTotal);
        } else {
          setSaldoPeriodo(null);
        }
        setMovimientosRango(Array.isArray(data.movimientos) ? data.movimientos : []);
      })
      .catch(() => {
        setSaldoPeriodo(null);
        setMovimientosRango([]);
      })
      .finally(() => setLoadingSaldo(false));
  }, [isOpen, desde, hasta, mes, anio]);

  useEffect(() => {
    if (!legajoDropdownOpen || !busquedaLegajo.trim()) {
      setLegajoOptions([]);
      return;
    }
    setLoadingLegajos(true);
    const q = encodeURIComponent(busquedaLegajo.trim());
    fetch(`/api/tesoreria/cobro-certificaciones/legajos?q=${q}&limit=50`)
      .then((res) => res.json())
      .then((data) => setLegajoOptions(data.data ?? []))
      .catch(() => setLegajoOptions([]))
      .finally(() => setLoadingLegajos(false));
  }, [legajoDropdownOpen, busquedaLegajo]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (legajoDropdownRef.current && !legajoDropdownRef.current.contains(e.target as Node)) {
        setLegajoDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const agregarLegajo = (opt: LegajoOption) => {
    if (legajos.some((l) => l.legajoId === opt.id)) return;
    setLegajos((prev) => [
      ...prev,
      { legajoId: opt.id, nombre: opt.nombre, monto: 0 },
    ]);
    setBusquedaLegajo("");
    setLegajoDropdownOpen(false);
  };

  const quitarLegajo = (legajoId: string) => {
    setLegajos((prev) => prev.filter((l) => l.legajoId !== legajoId));
  };

  const handleGuardar = async () => {
    const d = parseFechaToDate(desde);
    const h = parseFechaToDate(hasta);
    if (!d || !h || d > h) {
      showMessage("error", "Seleccioná un período válido (Desde y Hasta).");
      return;
    }
    if (saldoPeriodo == null) {
      showMessage("error", "Esperá a que cargue el saldo del período.");
      return;
    }
    const pct = parseFloat(porcentaje.replace(",", "."));
    if (Number.isNaN(pct) || pct < 0 || pct > 100) {
      showMessage("error", "Ingresá un porcentaje de comisión válido (0-100).");
      return;
    }
    const total = Math.round(totalComision * 100) / 100;
    const legajosConMonto: { legajoId: string; nombre: string; monto: number }[] = legajos.map(
      (l) => ({ ...l, monto: montoPorLegajo })
    );

    setGuardando(true);
    try {
      const res = await fetch("/api/tesoreria/cobro-certificaciones/comisiones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mes,
          anio,
          fechaDesde: desde,
          fechaHasta: hasta,
          saldoPeriodo,
          porcentaje: pct,
          totalComision: total,
          legajos: legajosConMonto,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        showMessage("error", data.error || "Error al guardar.");
        setGuardando(false);
        return;
      }

      const movs = movimientosRango;
      const nombreMes = MESES[mes - 1];
      const desdeSafe = desde.replace(/\D/g, "");
      const hastaSafe = hasta.replace(/\D/g, "");
      const nombreArchivoBase =
        desdeSafe && hastaSafe
          ? `CobroCertificaciones_${desdeSafe}_${hastaSafe}.xlsx`
          : `CobroCertificaciones_${nombreMes}_${anio}.xlsx`;
      const nombreArchivo = nombreArchivoBase;
      const numFormat = "#,##0.00";

      const filas: (string | number)[][] = [];
      filas.push([`Cobro Certificaciones - ${nombreMes} ${anio}`]);
      filas.push([]);
      filas.push([`Periodo Desde ${desde} hasta ${hasta}`]);
      filas.push([]);
      filas.push(["Fecha", "Concepto", "Importe", "Saldo"]);
      movs.forEach((m) => {
        filas.push([
          formatFechaDDMMYYYY(m.fecha),
          m.concepto,
          m.importe,
          m.saldo,
        ]);
      });
      filas.push(["Total ingresos", "", saldoPeriodo, ""]);
      filas.push([], []);
      filas.push(["Total:", "", saldoPeriodo, ""]);
      filas.push([`Comisión ${pct}%`, "", total, ""]);
      filas.push(["Legajo / Nombre", "Comisión"]);
      legajosConMonto.forEach((l) => {
        const pctLegajo = legajos.length > 0 ? (pct / legajos.length).toFixed(1) : "0";
        filas.push([`${l.nombre} ${pctLegajo}%`, l.monto]);
      });
      filas.push(["Total", ""]);

      const ws = XLSX.utils.aoa_to_sheet(filas);
      ws["!merges"] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: 3 } },
        { s: { r: 2, c: 0 }, e: { r: 2, c: 3 } },
      ];

      const firstDataRow = 4;
      const lastDataRow = 3 + movs.length;
      for (let r = firstDataRow; r <= lastDataRow; r++) {
        const cCell = ws[XLSX.utils.encode_cell({ r, c: 2 })];
        const dCell = ws[XLSX.utils.encode_cell({ r, c: 3 })];
        if (cCell && cCell.t === "n") cCell.z = numFormat;
        if (dCell && dCell.t === "n") dCell.z = numFormat;
      }
      const totalIngresosRow = 4 + movs.length;
      const totalRow = 7 + movs.length;
      const comisionRow = 8 + movs.length;
      [totalIngresosRow, totalRow, comisionRow].forEach((rowIdx) => {
        const c = ws[XLSX.utils.encode_cell({ r: rowIdx, c: 2 })];
        if (c && c.t === "n") c.z = numFormat;
      });
      const firstLegajoRow = 10 + movs.length;
      const lastLegajoRow = 9 + movs.length + legajosConMonto.length;
      const totalFormulaRow = 10 + movs.length + legajosConMonto.length;
      for (let r = firstLegajoRow; r <= lastLegajoRow; r++) {
        const cell = ws[XLSX.utils.encode_cell({ r, c: 1 })];
        if (cell && cell.t === "n") cell.z = numFormat;
      }
      const totalFormulaRef = XLSX.utils.encode_cell({ r: totalFormulaRow, c: 1 });
      ws[totalFormulaRef] = {
        t: "n",
        f: `SUM(B${firstLegajoRow + 1}:B${lastLegajoRow + 1})`,
        z: numFormat,
      };

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Cobro Certificaciones");
      const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
      const blob = new Blob([wbout], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = nombreArchivo;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      showMessage("ok", "Comisión guardada y Excel descargado.");
      onClose();
    } catch {
      showMessage("error", "Error de conexión.");
    } finally {
      setGuardando(false);
    }
  };

  const legajosConMontoActualizado = legajos.map((l) => ({
    ...l,
    monto: montoPorLegajo,
  }));

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Comisiones</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="space-y-2">
            <Label>Período</Label>
            <div className="flex gap-2 items-center flex-wrap">
              <div>
                <span className="text-xs text-gray-500 block">Desde</span>
                <InputFecha
                  placeholder="DD/MM/YYYY"
                  value={desde}
                  onChange={setDesde}
                  className="w-32 flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                />
              </div>
              <div>
                <span className="text-xs text-gray-500 block">Hasta</span>
                <InputFecha
                  placeholder="DD/MM/YYYY"
                  value={hasta}
                  onChange={setHasta}
                  className="w-32 flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                />
              </div>
            </div>
            {loadingSaldo && (
              <p className="text-sm text-gray-500">Calculando saldo…</p>
            )}
            {!loadingSaldo && saldoPeriodo != null && (
              <p className="text-sm font-semibold text-green-700">
                Saldo Total del Período: $ {formatearImporteAR(saldoPeriodo)}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Comisión</Label>
            <div className="flex items-center gap-2">
              <Input
                type="text"
                inputMode="decimal"
                placeholder="Ej: 15"
                value={porcentaje}
                onChange={(e) => setPorcentaje(e.target.value)}
                className="w-24"
              />
              <span className="text-gray-600">%</span>
            </div>
            <p className="text-sm font-semibold text-gray-700">
              Total Comisiones: $ {formatearImporteAR(totalComision)}
            </p>
          </div>

          <div className="space-y-2">
            <Label>Legajos</Label>
            <div className="relative" ref={legajoDropdownRef}>
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <Input
                    placeholder="Buscar legajo..."
                    value={busquedaLegajo}
                    onChange={(e) => {
                      setBusquedaLegajo(e.target.value);
                      setLegajoDropdownOpen(true);
                    }}
                    onFocus={() => busquedaLegajo && setLegajoDropdownOpen(true)}
                  />
                  {legajoDropdownOpen && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border rounded-lg shadow-lg z-50 max-h-48 overflow-y-auto">
                      {loadingLegajos ? (
                        <div className="p-3 text-sm text-gray-500">Cargando…</div>
                      ) : legajoOptions.length === 0 ? (
                        <div className="p-3 text-sm text-gray-500">
                          {busquedaLegajo.trim() ? "Sin resultados" : "Escribí para buscar"}
                        </div>
                      ) : (
                        legajoOptions.map((opt) => (
                          <button
                            key={opt.id}
                            type="button"
                            className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 flex justify-between"
                            onClick={() => agregarLegajo(opt)}
                          >
                            <span>{opt.nombre}</span>
                            <span className="text-gray-500">#{opt.numeroLegajo}</span>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
                <Button
                  type="button"
                  variant="default"
                  className="bg-green-600 hover:bg-green-700"
                  onClick={() => setLegajoDropdownOpen((o) => !o)}
                >
                  + Ingresar
                </Button>
              </div>
            </div>
            <div className="space-y-1 mt-2">
              {legajosConMontoActualizado.map((l) => (
                <div
                  key={l.legajoId}
                  className="flex items-center justify-between text-sm py-1.5 border-b border-gray-100"
                >
                  <span>
                    Comisión ({l.nombre}) $ {formatearImporteAR(l.monto)}
                  </span>
                  <button
                    type="button"
                    onClick={() => quitarLegajo(l.legajoId)}
                    className="text-gray-400 hover:text-red-600 p-0.5"
                    title="Quitar"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={handleGuardar}
            disabled={guardando || saldoPeriodo == null}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {guardando ? "Guardando…" : "Guardar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
