"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Pencil,
  Check,
  X,
  Trash2,
  Plus,
  RefreshCw,
} from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InputFecha } from "@/components/ui/InputFecha";
import { formatearFechaUTC, parsearFechaSegura } from "@/lib/utils/fecha";
import { ExportarExcelButton } from "@/components/tesoreria/informe/ExportarExcelButton";
import { COMPROMISOS_PREDEFINIDOS } from "@/lib/tesoreria/informeCompromisosPredeterminados";
import * as XLSX from "xlsx";

type ApiInforme = {
  id: number;
  fechaDesde: string;
  fechaHasta: string;
  egresos: Array<{
    id: number;
    numero: string | null;
    concepto: string;
    importe: number;
    orden: number;
  }>;
  compromisos: Array<{
    id: number;
    numero: string | null;
    concepto: string;
    importe: number;
    orden: number;
  }>;
  textBoxes: Array<{
    id: number;
    numero: number;
    contenido: string;
    orden: number;
  }>;
  ultimosAportes: Array<{
    id: number;
    distritoNumero: number;
    fechaOverride: string | null;
  }>;
};

type DatosInforme = {
  ingresosDistrito: Array<{
    distritoNumero: number;
    periodos: string;
    ctaColegImporte: number;
    nMatriculadosImporte: number;
  }>;
  totalIngresosA: number;
  cobroCertificaciones: {
    importe: number;
    periodoDesde: string;
    periodoHasta: string;
  };
  totalIngresosB: number;
  totalGeneralIngresos: number;
  egresosCuentas: Array<{
    cuentaId: number;
    nombreCuenta: string;
    totalMovimientos: number;
  }>;
  totalEgresos: number;
  ultimosAportes: Array<{
    distritoNumero: number;
    ultimaFecha: string | null;
    tieneOverride: boolean;
    fechaOverride: string | null;
  }>;
  conciliacion: {
    saldoBancoRio: number;
    saldoFondoFijo: number;
    chequesADepositar: number;
    total: number;
  };
};

type IngresoADistrito = {
  distritoNumero: number;
  hidden: boolean;
  isEditing: boolean;
  concepto1: string;
  importe1: number;
  concepto2: string;
  importe2: number;
  draftConcepto1: string;
  draftImporte1: string;
  draftConcepto2: string;
  draftImporte2: string;
};

type EgresoRow = {
  id: number | null;
  numero: string;
  concepto: string;
  importe: number;
  orden: number;
  isEditing: boolean;
  draftNumero: string;
  draftConcepto: string;
  draftImporte: string;
};

type CompromisoRow = {
  id: number | null;
  numero: string;
  concepto: string;
  importe: number;
  orden: number;
  isEditing: boolean;
  draftNumero: string;
  draftConcepto: string;
  draftImporte: string;
};

type TextBoxRow = {
  id: number | null;
  numero: number;
  contenido: string;
  orden: number;
  isEditing: boolean;
  draftContenido: string;
};

type UltimoAporteRow = {
  distritoNumero: number;
  fechaMostradaIso: string | null;
  isEditing: boolean;
  draftFecha: string;
  saving: boolean;
};

function formatARS(n: number): string {
  return n.toLocaleString("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function romano(n: number): string {
  return (
    {
      1: "I",
      2: "II",
      3: "III",
      4: "IV",
      5: "V",
      6: "VI",
      7: "VII",
      8: "VIII",
      9: "IX",
      10: "X",
    }[n] ?? String(n)
  );
}

function formatPeriodoLargo(desdeIso: string, hastaIso: string): string {
  const d = new Date(desdeIso);
  const h = new Date(hastaIso);
  const dDia = d.toLocaleDateString("es-AR", {
    day: "2-digit",
    timeZone: "UTC",
  });
  const hDia = h.toLocaleDateString("es-AR", {
    day: "2-digit",
    timeZone: "UTC",
  });
  const dMes = d.toLocaleDateString("es-AR", {
    month: "long",
    timeZone: "UTC",
  });
  const hMes = h.toLocaleDateString("es-AR", {
    month: "long",
    timeZone: "UTC",
  });
  const hAnio = h.toLocaleDateString("es-AR", {
    year: "numeric",
    timeZone: "UTC",
  });
  return `${dDia} de ${dMes} al ${hDia} de ${hMes} ${hAnio}`;
}

function toYmdFromIso(iso: string): string {
  return iso.slice(0, 10);
}

function ddmmyyyyToIso(ddmmyyyy: string): string | null {
  const d = parsearFechaSegura(ddmmyyyy);
  if (!d) return null;
  return d.toISOString().slice(0, 10);
}

const COMPROMISOS_ALIAS: Record<string, string[]> = {
  "Luz, Gas, T.E, Imp. Y Serv.": ["luz gas t e imp y serv", "luz, gas, t.e, imp. y serv"],
  "Cargas Sociales": ["cargas sociales"],
  "Sindicato UTEDYC": ["sindicato utedyc"],
  "Asesoría Legal": ["asesoria legal"],
  "Asesoría Contable": ["asesoria contable"],
  "Asesoría Comunicación Pág. Web C.S.": ["asesoria comunicacion pag web c s", "asesoria comunicacion"],
  "Mantenimiento pág. Web C.S.": ["mantenimiento pag web c s", "mantenimiento pag web"],
  "Tarj. de crédito C.S.": ["tarj de credito c s", "tarjeta de credito c s", "tarj. de credito c.s."],
  "Gustavo Papa (com. Prof. -radio)": ["gustavo papa"],
  "SP (alarma)": ["sp (alarma)", "sp alarma"],
  "FEPUBA CTA.": ["fepuba cta"],
  "The Site": ["the site"],
  "Sparkling (Dispenser agua)": ["sparkling", "dispenser agua"],
  "La Segunda (Seguro casa)": ["la segunda", "seguro casa"],
  "Berkley (Seguro de vida Personal)": ["berkley", "seguro de vida personal"],
  "Mensajería": ["mensajeria", "mensajería"],
};

function normalizarTexto(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function parseImporteExcel(valor: unknown): number | null {
  if (typeof valor === "number" && Number.isFinite(valor)) return Math.abs(valor);
  if (typeof valor !== "string") return null;
  const t = valor.trim();
  if (!t) return null;
  const soloNumero = t.replace(/\$/g, "").replace(/\s/g, "");
  if (!/[0-9]/.test(soloNumero)) return null;
  let canon = soloNumero;
  if (soloNumero.includes(".") && soloNumero.includes(",")) {
    canon = soloNumero.replace(/\./g, "").replace(",", ".");
  } else if (soloNumero.includes(",") && !soloNumero.includes(".")) {
    canon = soloNumero.replace(",", ".");
  } else {
    canon = soloNumero.replace(/,/g, "");
  }
  const n = Number(canon);
  return Number.isFinite(n) ? Math.abs(n) : null;
}

function extraerCompromisosDesdeLibro(wb: XLSX.WorkBook): Map<string, number> {
  const out = new Map<string, number>();
  for (const name of wb.SheetNames) {
    const ws = wb.Sheets[name];
    if (!ws) continue;
    const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: true, defval: null });
    for (const row of rows) {
      if (!Array.isArray(row) || row.length === 0) continue;
      const textoFila = normalizarTexto(
        row.map((c) => (typeof c === "string" ? c : "")).filter(Boolean).join(" ")
      );
      if (!textoFila) continue;
      let conceptoCanonico: string | null = null;
      for (const concepto of COMPROMISOS_PREDEFINIDOS) {
        const aliases = [concepto, ...(COMPROMISOS_ALIAS[concepto] ?? [])];
        if (aliases.some((a) => textoFila.includes(normalizarTexto(a)))) {
          conceptoCanonico = concepto;
          break;
        }
      }
      if (!conceptoCanonico) continue;
      for (let i = row.length - 1; i >= 0; i--) {
        const importe = parseImporteExcel(row[i]);
        if (importe != null) {
          out.set(conceptoCanonico, importe);
          break;
        }
      }
    }
  }
  return out;
}

export default function InformeTesoreriaDetallePage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params?.id;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<{ tipo: "ok" | "error"; text: string } | null>(
    null
  );

  const [informe, setInforme] = useState<ApiInforme | null>(null);
  const [datos, setDatos] = useState<DatosInforme | null>(null);

  const [desdeControl, setDesdeControl] = useState("");
  const [hastaControl, setHastaControl] = useState("");
  const [certDesde, setCertDesde] = useState("");
  const [certHasta, setCertHasta] = useState("");

  const [ingresosA, setIngresosA] = useState<IngresoADistrito[]>([]);
  const [ingresoBDeleted, setIngresoBDeleted] = useState(false);
  const [ingresoBEditing, setIngresoBEditing] = useState(false);
  const [ingresoBConcepto, setIngresoBConcepto] = useState("COBRO CERTIFICACIONES");
  const [ingresoBImporte, setIngresoBImporte] = useState(0);
  const [ingresoBDraftConcepto, setIngresoBDraftConcepto] = useState("COBRO CERTIFICACIONES");
  const [ingresoBDraftImporte, setIngresoBDraftImporte] = useState("0");

  const [egresos, setEgresos] = useState<EgresoRow[]>([]);
  const [egresosPersistidos, setEgresosPersistidos] = useState(false);
  const [compromisos, setCompromisos] = useState<CompromisoRow[]>([]);
  const [textBoxes, setTextBoxes] = useState<TextBoxRow[]>([]);
  const [ultimosAportes, setUltimosAportes] = useState<UltimoAporteRow[]>([]);

  const [conciliacionEditing, setConciliacionEditing] = useState<
    null | "banco" | "fondo" | "cheques"
  >(null);
  const [saldoBancoRio, setSaldoBancoRio] = useState(0);
  const [saldoFondoFijo, setSaldoFondoFijo] = useState(0);
  const [chequesDepositar, setChequesDepositar] = useState(0);
  const [concDraft, setConcDraft] = useState("0");
  const compromisosExcelRef = useRef<HTMLInputElement | null>(null);
  const [detalleImportacionCompromisos, setDetalleImportacionCompromisos] = useState<
    string[] | null
  >(null);

  const showMessage = useCallback((tipo: "ok" | "error", text: string) => {
    setMensaje({ tipo, text });
  }, []);

  useEffect(() => {
    if (!mensaje) return;
    const t = setTimeout(() => setMensaje(null), 4500);
    return () => clearTimeout(t);
  }, [mensaje]);

  const hydrateFromDatos = useCallback(
    (d: DatosInforme, baseInforme?: ApiInforme | null) => {
      const incA: IngresoADistrito[] = [];
      for (let n = 1; n <= 10; n++) {
        const hit = d.ingresosDistrito.find((x) => x.distritoNumero === n);
        const periodos = hit?.periodos?.trim();
        incA.push({
          distritoNumero: n,
          hidden: false,
          isEditing: false,
          concepto1: `Cta. Coleg.${periodos ? ` ${periodos}` : ""}`,
          importe1: hit?.ctaColegImporte ?? 0,
          concepto2: "Nuevos matriculados",
          importe2: hit?.nMatriculadosImporte ?? 0,
          draftConcepto1: `Cta. Coleg.${periodos ? ` ${periodos}` : ""}`,
          draftImporte1: String(hit?.ctaColegImporte ?? 0),
          draftConcepto2: "Nuevos matriculados",
          draftImporte2: String(hit?.nMatriculadosImporte ?? 0),
        });
      }
      setIngresosA(incA);
      setIngresoBDeleted(false);
      setIngresoBEditing(false);
      setIngresoBConcepto("COBRO CERTIFICACIONES");
      setIngresoBDraftConcepto("COBRO CERTIFICACIONES");
      setIngresoBImporte(d.cobroCertificaciones.importe);
      setIngresoBDraftImporte(String(d.cobroCertificaciones.importe));

      setSaldoBancoRio(d.conciliacion.saldoBancoRio);
      setSaldoFondoFijo(d.conciliacion.saldoFondoFijo);
      setChequesDepositar(d.conciliacion.chequesADepositar);
      setConciliacionEditing(null);
      setConcDraft("0");

      const ua: UltimoAporteRow[] = [];
      for (let n = 1; n <= 10; n++) {
        const hit = d.ultimosAportes.find((x) => x.distritoNumero === n);
        const iso = hit?.fechaOverride ?? hit?.ultimaFecha ?? null;
        ua.push({
          distritoNumero: n,
          fechaMostradaIso: iso,
          isEditing: false,
          draftFecha: iso ? formatearFechaUTC(new Date(iso)) : "",
          saving: false,
        });
      }
      setUltimosAportes(ua);

      const inf = baseInforme ?? informe;
      if (inf && inf.egresos.length > 0) {
        setEgresosPersistidos(true);
        setEgresos(
          [...inf.egresos]
            .sort((a, b) => a.orden - b.orden || a.id - b.id)
            .map((x) => ({
              id: x.id,
              numero: x.numero ?? "",
              concepto: x.concepto,
              importe: x.importe,
              orden: x.orden,
              isEditing: false,
              draftNumero: x.numero ?? "",
              draftConcepto: x.concepto,
              draftImporte: String(x.importe),
            }))
        );
      } else {
        setEgresosPersistidos(false);
        setEgresos(
          d.egresosCuentas.map((x, idx) => ({
            id: null,
            numero: "",
            concepto: x.nombreCuenta,
            importe: x.totalMovimientos,
            orden: idx,
            isEditing: false,
            draftNumero: "",
            draftConcepto: x.nombreCuenta,
            draftImporte: String(x.totalMovimientos),
          }))
        );
      }

      const compromisosBase =
        inf && inf.compromisos.length > 0
          ? [...inf.compromisos]
              .sort((a, b) => a.orden - b.orden || a.id - b.id)
              .map((x) => ({
                id: x.id,
                numero: x.numero ?? "",
                concepto: x.concepto,
                importe: x.importe,
                orden: x.orden,
                isEditing: false,
                draftNumero: x.numero ?? "",
                draftConcepto: x.concepto,
                draftImporte: String(x.importe),
              }))
          : COMPROMISOS_PREDEFINIDOS.map((concepto, idx) => ({
              id: null,
              numero: "",
              concepto,
              importe: 0,
              orden: idx,
              isEditing: false,
              draftNumero: "",
              draftConcepto: concepto,
              draftImporte: "0",
            }));
      setCompromisos(compromisosBase);
    },
    [informe]
  );

  const importarCompromisosExcel = async (file: File) => {
    if (!id) return;
    setSavingKey("co-import");
    setDetalleImportacionCompromisos(null);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const importes = extraerCompromisosDesdeLibro(wb);
      if (importes.size === 0) {
        showMessage("error", "No se detectaron compromisos del punto IV en el Excel.");
        return;
      }
      const faltantes = COMPROMISOS_PREDEFINIDOS.filter((c) => !importes.has(c));

      const byConcepto = new Map(
        compromisos.map((c) => [normalizarTexto(c.concepto), c] as const)
      );
      const rows = COMPROMISOS_PREDEFINIDOS.map((concepto, idx) => {
        const existing = byConcepto.get(normalizarTexto(concepto));
        const importe = importes.get(concepto) ?? existing?.importe ?? 0;
        return {
          id: existing?.id ?? null,
          numero: existing?.numero ?? "",
          concepto,
          importe,
          orden: idx,
        };
      });

      const persisted: CompromisoRow[] = [];
      for (const r of rows) {
        const payload = {
          numero: r.numero.trim() || null,
          concepto: r.concepto,
          importe: r.importe,
          orden: r.orden,
        };
        const res = r.id
          ? await fetch(`/api/tesoreria/informe/${id}/compromisos/${r.id}`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload),
            })
          : await fetch(`/api/tesoreria/informe/${id}/compromisos`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload),
            });
        const j = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(j?.error || `No se pudo guardar compromiso: ${r.concepto}`);
        }
        persisted.push({
          id: j.id ?? r.id,
          numero: j.numero ?? r.numero,
          concepto: j.concepto ?? r.concepto,
          importe: Number(j.importe ?? r.importe),
          orden: j.orden ?? r.orden,
          isEditing: false,
          draftNumero: j.numero ?? r.numero,
          draftConcepto: j.concepto ?? r.concepto,
          draftImporte: String(Number(j.importe ?? r.importe)),
        });
      }
      setCompromisos(persisted);
      showMessage(
        "ok",
        `Importación completada. Detectados: ${importes.size}/${COMPROMISOS_PREDEFINIDOS.length}. Faltantes: ${faltantes.length}.`
      );
      if (faltantes.length > 0) {
        setDetalleImportacionCompromisos(faltantes);
      }
    } catch (err) {
      setDetalleImportacionCompromisos(null);
      showMessage("error", err instanceof Error ? err.message : "No se pudo importar el Excel.");
    } finally {
      setSavingKey(null);
      if (compromisosExcelRef.current) compromisosExcelRef.current.value = "";
    }
  };

  const fetchAll = useCallback(
    async (opts?: { keepPeriod?: boolean; certRange?: { desde?: string; hasta?: string } }) => {
      if (!id) return;
      const first = !informe;
      if (first) setLoading(true);
      else setRefreshing(true);
      try {
        const infRes = await fetch(`/api/tesoreria/informe/${id}`);
        const infJson = await infRes.json().catch(() => ({}));
        if (!infRes.ok) {
          showMessage("error", infJson?.error || "No se pudo cargar el informe.");
          setLoading(false);
          setRefreshing(false);
          return;
        }
        const inf = infJson as ApiInforme;
        setInforme(inf);

        if (!opts?.keepPeriod || !desdeControl || !hastaControl) {
          setDesdeControl(formatearFechaUTC(new Date(inf.fechaDesde)));
          setHastaControl(formatearFechaUTC(new Date(inf.fechaHasta)));
        }

        const desdeYmd = ddmmyyyyToIso(
          opts?.keepPeriod && desdeControl ? desdeControl : formatearFechaUTC(new Date(inf.fechaDesde))
        );
        const hastaYmd = ddmmyyyyToIso(
          opts?.keepPeriod && hastaControl ? hastaControl : formatearFechaUTC(new Date(inf.fechaHasta))
        );
        if (!desdeYmd || !hastaYmd) {
          showMessage("error", "No se pudieron interpretar las fechas del período.");
          setLoading(false);
          setRefreshing(false);
          return;
        }

        const certD = opts?.certRange?.desde ? ddmmyyyyToIso(opts.certRange.desde) : ddmmyyyyToIso(certDesde);
        const certH = opts?.certRange?.hasta ? ddmmyyyyToIso(opts.certRange.hasta) : ddmmyyyyToIso(certHasta);

        const qs = new URLSearchParams({
          fechaDesde: desdeYmd,
          fechaHasta: hastaYmd,
        });
        if (certD && certH) {
          qs.set("certDesde", certD);
          qs.set("certHasta", certH);
        }
        const datosRes = await fetch(`/api/tesoreria/informe/${id}/datos?${qs.toString()}`);
        const datosJson = await datosRes.json().catch(() => ({}));
        if (!datosRes.ok) {
          showMessage("error", datosJson?.error || "No se pudieron cargar los datos calculados.");
          setLoading(false);
          setRefreshing(false);
          return;
        }
        const d = datosJson as DatosInforme;
        setDatos(d);
        hydrateFromDatos(d, inf);
        if (!certDesde || !certHasta) {
          setCertDesde(formatearFechaUTC(new Date(d.cobroCertificaciones.periodoDesde)));
          setCertHasta(formatearFechaUTC(new Date(d.cobroCertificaciones.periodoHasta)));
        }
      } catch {
        showMessage("error", "Error de conexión.");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [
      id,
      informe,
      desdeControl,
      hastaControl,
      certDesde,
      certHasta,
      hydrateFromDatos,
      showMessage,
    ]
  );

  useEffect(() => {
    if (!id) return;
    void fetchAll();
    // Evita bucle de recarga: fetchAll actualiza estados que cambian su referencia.
    // La carga inicial debe dispararse por cambio de id, no por cada recreación de fetchAll.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const totalIngresosA = useMemo(
    () =>
      ingresosA
        .filter((x) => !x.hidden)
        .reduce((acc, x) => acc + x.importe1 + x.importe2, 0),
    [ingresosA]
  );

  const totalIngresosB = ingresoBDeleted ? 0 : ingresoBImporte;
  const totalGeneralIngreso = totalIngresosA + totalIngresosB;
  const totalEgresos = egresos.reduce((acc, x) => acc + x.importe, 0);
  const totalCompromisos = compromisos.reduce((acc, x) => acc + x.importe, 0);
  const totalConciliacion = saldoBancoRio + saldoFondoFijo + chequesDepositar;
  const saldoFinal = totalConciliacion - totalCompromisos;

  const onActualizar = async () => {
    if (!id || !informe) return;
    const d0 = parsearFechaSegura(desdeControl.trim());
    const d1 = parsearFechaSegura(hastaControl.trim());
    if (!d0 || !d1) {
      showMessage("error", "Fechas inválidas. Usá DD/MM/YYYY.");
      return;
    }
    if (d0.getTime() > d1.getTime()) {
      showMessage("error", "La fecha Desde no puede ser posterior a Hasta.");
      return;
    }

    if (!egresosPersistidos && egresos.length > 0) {
      const ok = confirm(
        "¿Cargar egresos desde Mayores-Cuentas? Esto sobreescribirá los cambios manuales."
      );
      if (!ok) return;
    }

    setSavingKey("actualizar");
    try {
      const upRes = await fetch(`/api/tesoreria/informe/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fechaDesde: d0.toISOString(),
          fechaHasta: d1.toISOString(),
        }),
      });
      const upJson = await upRes.json().catch(() => ({}));
      if (!upRes.ok) {
        showMessage("error", upJson?.error || "No se pudo actualizar el período.");
        return;
      }
      const informeActualizado = upJson as ApiInforme;
      setInforme(informeActualizado);

      const certD = ddmmyyyyToIso(certDesde);
      const certH = ddmmyyyyToIso(certHasta);
      const qs = new URLSearchParams({
        fechaDesde: d0.toISOString().slice(0, 10),
        fechaHasta: d1.toISOString().slice(0, 10),
      });
      if (certD && certH) {
        qs.set("certDesde", certD);
        qs.set("certHasta", certH);
      }
      const datosRes = await fetch(`/api/tesoreria/informe/${id}/datos?${qs.toString()}`);
      const datosJson = await datosRes.json().catch(() => ({}));
      if (!datosRes.ok) {
        showMessage("error", datosJson?.error || "No se pudieron cargar los datos calculados.");
        return;
      }
      const d = datosJson as DatosInforme;
      setDatos(d);
      hydrateFromDatos(d, informeActualizado);
      showMessage("ok", "Informe actualizado.");
    } catch {
      showMessage("error", "Error de conexión.");
    } finally {
      setSavingKey(null);
    }
  };

  const aplicarPeriodoCert = async () => {
    if (!id || !informe) return;
    const d0 = parsearFechaSegura(certDesde.trim());
    const d1 = parsearFechaSegura(certHasta.trim());
    if (!d0 || !d1) {
      showMessage("error", "Fechas de certificaciones inválidas.");
      return;
    }
    if (d0.getTime() > d1.getTime()) {
      showMessage("error", "El período de certificaciones es inválido.");
      return;
    }
    const desdeYmd = ddmmyyyyToIso(desdeControl);
    const hastaYmd = ddmmyyyyToIso(hastaControl);
    const certD = ddmmyyyyToIso(certDesde);
    const certH = ddmmyyyyToIso(certHasta);
    if (!desdeYmd || !hastaYmd || !certD || !certH) {
      showMessage("error", "No se pudieron interpretar las fechas.");
      return;
    }

    setRefreshing(true);
    try {
      const qs = new URLSearchParams({
        fechaDesde: desdeYmd,
        fechaHasta: hastaYmd,
        certDesde: certD,
        certHasta: certH,
      });
      const datosRes = await fetch(`/api/tesoreria/informe/${id}/datos?${qs.toString()}`);
      const datosJson = await datosRes.json().catch(() => ({}));
      if (!datosRes.ok) {
        showMessage("error", datosJson?.error || "No se pudieron cargar los datos calculados.");
        return;
      }
      const d = datosJson as DatosInforme;
      setDatos(d);
      hydrateFromDatos(d, informe);
    } catch {
      showMessage("error", "Error de conexión.");
      return;
    } finally {
      setRefreshing(false);
    }
    showMessage("ok", "Período de certificaciones aplicado.");
  };

  if (loading || !informe || !datos) {
    return (
      <div className="max-w-[1600px] mx-auto mt-6">
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            Cargando informe…
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-[1600px] mx-auto mt-6 space-y-6">
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
        <CardContent className="pt-6">
          <h1 className="text-center text-3xl font-bold text-gray-800">INFORME DE TESORERÍA</h1>
          <p className="text-center text-gray-600 mt-2">
            Período: del {formatPeriodoLargo(informe.fechaDesde, informe.fechaHasta)}
          </p>

          <div className="mt-6 flex flex-wrap items-end gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">Desde</Label>
              <InputFecha value={desdeControl} onChange={setDesdeControl} className="mt-1 h-9 px-3 border rounded-md" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Hasta</Label>
              <InputFecha value={hastaControl} onChange={setHastaControl} className="mt-1 h-9 px-3 border rounded-md" />
            </div>
            <Button
              type="button"
              onClick={() => void onActualizar()}
              disabled={savingKey === "actualizar" || refreshing}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              {savingKey === "actualizar" || refreshing ? "Actualizando…" : "Actualizar"}
            </Button>
            <ExportarExcelButton
              informe={{
                fechaDesde: new Date(informe.fechaDesde),
                fechaHasta: new Date(informe.fechaHasta),
              }}
              ingresosDistrito={ingresosA
                .filter((x) => !x.hidden)
                .map((x) => ({
                  distritoNumero: x.distritoNumero,
                  periodos:
                    datos.ingresosDistrito.find((d) => d.distritoNumero === x.distritoNumero)
                      ?.periodos ?? "",
                  ctaColegImporte: x.importe1,
                  nMatriculadosImporte: x.importe2,
                }))}
              totalIngresosA={totalIngresosA}
              cobroCertificaciones={{ importe: totalIngresosB }}
              totalIngresosB={totalIngresosB}
              totalGeneralIngresos={totalGeneralIngreso}
              egresos={egresos.map((e) => ({
                numero: e.numero || undefined,
                concepto: e.concepto,
                importe: e.importe,
              }))}
              totalEgresos={totalEgresos}
              ultimosAportes={ultimosAportes.map((u) => ({
                distritoNumero: u.distritoNumero,
                fechaMostrar: u.fechaMostradaIso ? new Date(u.fechaMostradaIso) : null,
              }))}
              conciliacion={{
                saldoBancoRio,
                saldoFondoFijo,
                chequesADepositar: chequesDepositar,
                total: totalConciliacion,
              }}
              compromisos={compromisos.map((c) => ({
                numero: c.numero || undefined,
                concepto: c.concepto,
                importe: c.importe,
              }))}
              totalCompromisos={totalCompromisos}
              saldoFinal={saldoFinal}
              textBoxes={textBoxes.map((t) => ({
                numero: t.numero,
                contenido: t.contenido,
              }))}
            />
            <Button type="button" variant="outline" onClick={() => router.push("/tesoreria/informe")}>
              Volver
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <span className="font-semibold text-lg">A) INGRESOS.</span>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-gray-600">
                  <th className="p-2 pl-3 w-16">DIST.</th>
                  <th className="p-2">CONCEPTO</th>
                  <th className="p-2 text-right">IMPORTE</th>
                  <th className="p-2 text-right pr-3 w-36">ACCIONES</th>
                </tr>
              </thead>
              <tbody>
                {ingresosA
                  .filter((d) => !d.hidden)
                  .map((d) => (
                    <tr key={d.distritoNumero} className="border-b align-top">
                      <td className="p-2 pl-3 font-semibold">{romano(d.distritoNumero)}</td>
                      <td className="p-2 space-y-2">
                        <div>
                          {d.isEditing ? (
                            <Input
                              value={d.draftConcepto1}
                              onChange={(e) =>
                                setIngresosA((prev) =>
                                  prev.map((x) =>
                                    x.distritoNumero === d.distritoNumero
                                      ? { ...x, draftConcepto1: e.target.value }
                                      : x
                                  )
                                )
                              }
                            />
                          ) : (
                            <span>{d.concepto1}</span>
                          )}
                        </div>
                        <div>
                          {d.isEditing ? (
                            <Input
                              value={d.draftConcepto2}
                              onChange={(e) =>
                                setIngresosA((prev) =>
                                  prev.map((x) =>
                                    x.distritoNumero === d.distritoNumero
                                      ? { ...x, draftConcepto2: e.target.value }
                                      : x
                                  )
                                )
                              }
                            />
                          ) : (
                            <span>{d.concepto2}</span>
                          )}
                        </div>
                      </td>
                      <td className="p-2 text-right whitespace-nowrap">
                        <div className="space-y-2">
                          <div>
                            {d.isEditing ? (
                              <Input
                                className="text-right"
                                value={d.draftImporte1}
                                onChange={(e) =>
                                  setIngresosA((prev) =>
                                    prev.map((x) =>
                                      x.distritoNumero === d.distritoNumero
                                        ? { ...x, draftImporte1: e.target.value }
                                        : x
                                    )
                                  )
                                }
                              />
                            ) : (
                              <span>{formatARS(d.importe1)}</span>
                            )}
                          </div>
                          <div>
                            {d.isEditing ? (
                              <Input
                                className="text-right"
                                value={d.draftImporte2}
                                onChange={(e) =>
                                  setIngresosA((prev) =>
                                    prev.map((x) =>
                                      x.distritoNumero === d.distritoNumero
                                        ? { ...x, draftImporte2: e.target.value }
                                        : x
                                    )
                                  )
                                }
                              />
                            ) : (
                              <span>{d.importe2 === 0 ? "-" : formatARS(d.importe2)}</span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="p-2 pr-3">
                        <div className="flex justify-end gap-1">
                          {!d.isEditing ? (
                            <>
                              <button
                                type="button"
                                className="p-1.5 text-gray-500 hover:text-blue-600"
                                title="Editar"
                                onClick={() =>
                                  setIngresosA((prev) =>
                                    prev.map((x) =>
                                      x.distritoNumero === d.distritoNumero
                                        ? { ...x, isEditing: true }
                                        : x
                                    )
                                  )
                                }
                              >
                                <Pencil className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                className="p-1.5 text-red-500 hover:bg-red-50 rounded"
                                title="Borrar"
                                onClick={() => {
                                  if (!confirm("¿Quitar este distrito de la vista?")) return;
                                  setIngresosA((prev) =>
                                    prev.map((x) =>
                                      x.distritoNumero === d.distritoNumero
                                        ? { ...x, hidden: true }
                                        : x
                                    )
                                  );
                                }}
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                type="button"
                                className="p-1.5 text-green-600 hover:bg-green-50 rounded"
                                title="Guardar"
                                onClick={() =>
                                  setIngresosA((prev) =>
                                    prev.map((x) =>
                                      x.distritoNumero === d.distritoNumero
                                        ? {
                                            ...x,
                                            isEditing: false,
                                            concepto1: x.draftConcepto1.trim() || x.concepto1,
                                            concepto2: x.draftConcepto2.trim() || x.concepto2,
                                            importe1:
                                              Number(x.draftImporte1) || 0,
                                            importe2:
                                              Number(x.draftImporte2) || 0,
                                          }
                                        : x
                                    )
                                  )
                                }
                              >
                                <Check className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                className="p-1.5 text-gray-500 hover:bg-gray-100 rounded"
                                title="Cancelar"
                                onClick={() =>
                                  setIngresosA((prev) =>
                                    prev.map((x) =>
                                      x.distritoNumero === d.distritoNumero
                                        ? {
                                            ...x,
                                            isEditing: false,
                                            draftConcepto1: x.concepto1,
                                            draftConcepto2: x.concepto2,
                                            draftImporte1: String(x.importe1),
                                            draftImporte2: String(x.importe2),
                                          }
                                        : x
                                    )
                                  )
                                }
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                <tr className="font-semibold bg-muted/30">
                  <td className="p-2 pl-3" />
                  <td className="p-2">TOTAL</td>
                  <td className="p-2 text-right">{formatARS(totalIngresosA)}</td>
                  <td className="p-2 pr-3" />
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <span className="font-semibold text-lg">B) INGRESOS.</span>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-2">
            <div>
              <Label className="text-xs text-muted-foreground">Desde</Label>
              <InputFecha value={certDesde} onChange={setCertDesde} className="mt-1 h-9 px-3 border rounded-md" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Hasta</Label>
              <InputFecha value={certHasta} onChange={setCertHasta} className="mt-1 h-9 px-3 border rounded-md" />
            </div>
            <Button type="button" size="sm" onClick={() => void aplicarPeriodoCert()}>
              Aplicar período
            </Button>
          </div>

          <div className="border rounded-lg overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-gray-600">
                  <th className="p-2 pl-3">CONCEPTO</th>
                  <th className="p-2 text-right">IMPORTE</th>
                  <th className="p-2 pr-3 text-right w-36">ACCIONES</th>
                </tr>
              </thead>
              <tbody>
                {!ingresoBDeleted && (
                  <tr className="border-b">
                    <td className="p-2 pl-3">
                      {ingresoBEditing ? (
                        <Input
                          value={ingresoBDraftConcepto}
                          onChange={(e) => setIngresoBDraftConcepto(e.target.value)}
                        />
                      ) : (
                        ingresoBConcepto
                      )}
                    </td>
                    <td className="p-2 text-right">
                      {ingresoBEditing ? (
                        <Input
                          className="text-right"
                          value={ingresoBDraftImporte}
                          onChange={(e) => setIngresoBDraftImporte(e.target.value)}
                        />
                      ) : (
                        formatARS(ingresoBImporte)
                      )}
                    </td>
                    <td className="p-2 pr-3">
                      <div className="flex justify-end gap-1">
                        {!ingresoBEditing ? (
                          <>
                            <button
                              type="button"
                              className="p-1.5 text-gray-500 hover:text-blue-600"
                              onClick={() => setIngresoBEditing(true)}
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              className="p-1.5 text-red-500 hover:bg-red-50 rounded"
                              onClick={() => setIngresoBDeleted(true)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              className="p-1.5 text-green-600 hover:bg-green-50 rounded"
                              onClick={() => {
                                setIngresoBEditing(false);
                                setIngresoBConcepto(
                                  ingresoBDraftConcepto.trim() || "COBRO CERTIFICACIONES"
                                );
                                setIngresoBImporte(Number(ingresoBDraftImporte) || 0);
                              }}
                            >
                              <Check className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              className="p-1.5 text-gray-500 hover:bg-gray-100 rounded"
                              onClick={() => {
                                setIngresoBEditing(false);
                                setIngresoBDraftConcepto(ingresoBConcepto);
                                setIngresoBDraftImporte(String(ingresoBImporte));
                              }}
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
                <tr className="border-b font-medium">
                  <td className="p-2 pl-3">TOTAL</td>
                  <td className="p-2 text-right">{formatARS(totalIngresosB)}</td>
                  <td className="p-2 pr-3" />
                </tr>
                <tr className="font-bold bg-muted/30">
                  <td className="p-2 pl-3">TOTAL GENERAL INGRESO</td>
                  <td className="p-2 text-right">{formatARS(totalGeneralIngreso)}</td>
                  <td className="p-2 pr-3" />
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <span className="font-semibold text-lg">C) EGRESOS.</span>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-gray-600">
                  <th className="p-2 pl-3 w-20">N°</th>
                  <th className="p-2">CONCEPTO</th>
                  <th className="p-2 text-right">IMPORTE</th>
                  <th className="p-2 pr-3 text-right w-36">ACCIONES</th>
                </tr>
              </thead>
              <tbody>
                {egresos.map((e, idx) => (
                  <tr key={`${e.id ?? "new"}-${idx}`} className="border-b">
                    <td className="p-2 pl-3">
                      {e.isEditing ? (
                        <Input
                          value={e.draftNumero}
                          onChange={(ev) =>
                            setEgresos((prev) =>
                              prev.map((x, i) =>
                                i === idx ? { ...x, draftNumero: ev.target.value } : x
                              )
                            )
                          }
                        />
                      ) : (
                        e.numero || "—"
                      )}
                    </td>
                    <td className="p-2">
                      {e.isEditing ? (
                        <Input
                          value={e.draftConcepto}
                          onChange={(ev) =>
                            setEgresos((prev) =>
                              prev.map((x, i) =>
                                i === idx ? { ...x, draftConcepto: ev.target.value } : x
                              )
                            )
                          }
                        />
                      ) : (
                        e.concepto
                      )}
                    </td>
                    <td className="p-2 text-right">
                      {e.isEditing ? (
                        <Input
                          className="text-right"
                          value={e.draftImporte}
                          onChange={(ev) =>
                            setEgresos((prev) =>
                              prev.map((x, i) =>
                                i === idx ? { ...x, draftImporte: ev.target.value } : x
                              )
                            )
                          }
                        />
                      ) : (
                        formatARS(Math.abs(e.importe))
                      )}
                    </td>
                    <td className="p-2 pr-3">
                      <div className="flex justify-end gap-1">
                        {!e.isEditing ? (
                          <>
                            <button
                              type="button"
                              className="p-1.5 text-gray-500 hover:text-blue-600"
                              onClick={() =>
                                setEgresos((prev) =>
                                  prev.map((x, i) => (i === idx ? { ...x, isEditing: true } : x))
                                )
                              }
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              className="p-1.5 text-red-500 hover:bg-red-50 rounded"
                              onClick={async () => {
                                if (!confirm("¿Eliminar egreso?")) return;
                                if (e.id) {
                                  setSavingKey(`eg-del-${e.id}`);
                                  const res = await fetch(
                                    `/api/tesoreria/informe/${id}/egresos/${e.id}`,
                                    { method: "DELETE" }
                                  );
                                  setSavingKey(null);
                                  if (!res.ok) {
                                    const j = await res.json().catch(() => ({}));
                                    showMessage("error", j?.error || "No se pudo eliminar.");
                                    return;
                                  }
                                }
                                setEgresos((prev) => prev.filter((_, i) => i !== idx));
                                showMessage("ok", "Egreso eliminado.");
                              }}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              className="p-1.5 text-green-600 hover:bg-green-50 rounded"
                              onClick={async () => {
                                const concepto = e.draftConcepto.trim();
                                const importe = Number(e.draftImporte);
                                if (!concepto || Number.isNaN(importe)) {
                                  showMessage("error", "Concepto o importe inválido.");
                                  return;
                                }
                                const payload = {
                                  numero: e.draftNumero.trim() || null,
                                  concepto,
                                  importe,
                                  orden: e.orden,
                                };
                                setSavingKey(`eg-save-${idx}`);
                                const res = e.id
                                  ? await fetch(`/api/tesoreria/informe/${id}/egresos/${e.id}`, {
                                      method: "PUT",
                                      headers: { "Content-Type": "application/json" },
                                      body: JSON.stringify(payload),
                                    })
                                  : await fetch(`/api/tesoreria/informe/${id}/egresos`, {
                                      method: "POST",
                                      headers: { "Content-Type": "application/json" },
                                      body: JSON.stringify(payload),
                                    });
                                setSavingKey(null);
                                const j = await res.json().catch(() => ({}));
                                if (!res.ok) {
                                  showMessage("error", j?.error || "No se pudo guardar.");
                                  return;
                                }
                                setEgresos((prev) =>
                                  prev.map((x, i) =>
                                    i === idx
                                      ? {
                                          ...x,
                                          id: j.id ?? x.id,
                                          numero: j.numero ?? "",
                                          concepto: j.concepto ?? concepto,
                                          importe: Number(j.importe ?? importe),
                                          isEditing: false,
                                          draftNumero: j.numero ?? "",
                                          draftConcepto: j.concepto ?? concepto,
                                          draftImporte: String(Number(j.importe ?? importe)),
                                        }
                                      : x
                                  )
                                );
                                setEgresosPersistidos(true);
                                showMessage("ok", "Egreso guardado.");
                              }}
                            >
                              {savingKey === `eg-save-${idx}` ? (
                                <RefreshCw className="w-4 h-4 animate-spin" />
                              ) : (
                                <Check className="w-4 h-4" />
                              )}
                            </button>
                            <button
                              type="button"
                              className="p-1.5 text-gray-500 hover:bg-gray-100 rounded"
                              onClick={() =>
                                setEgresos((prev) =>
                                  prev.map((x, i) =>
                                    i === idx
                                      ? {
                                          ...x,
                                          isEditing: false,
                                          draftNumero: x.numero,
                                          draftConcepto: x.concepto,
                                          draftImporte: String(x.importe),
                                        }
                                      : x
                                  )
                                )
                              }
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                <tr className="font-semibold bg-muted/30">
                  <td className="p-2 pl-3" />
                  <td className="p-2">TOTAL EGRESOS</td>
                  <td className="p-2 text-right">{formatARS(Math.abs(totalEgresos))}</td>
                  <td className="p-2 pr-3" />
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <span className="font-bold text-center w-full underline">
            ÚLTIMOS APORTES DISTRITALES EN CONCEPTO DE NUEVOS MATRICULADOS Y GS. ADMINISTRATIVOS
          </span>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {[0, 1].map((col) => {
              const start = col === 0 ? 1 : 6;
              const end = col === 0 ? 5 : 10;
              return (
                <div key={col} className="border rounded-md overflow-hidden">
                  {ultimosAportes
                    .filter((x) => x.distritoNumero >= start && x.distritoNumero <= end)
                    .map((x) => (
                      <div
                        key={x.distritoNumero}
                        className="flex items-center justify-between gap-2 border-b last:border-b-0 px-3 py-2 text-sm"
                      >
                        <span className="font-medium">Distrito {romano(x.distritoNumero)}</span>
                        <div className="flex items-center gap-2">
                          {!x.isEditing ? (
                            <span>
                              {x.fechaMostradaIso
                                ? formatearFechaUTC(new Date(x.fechaMostradaIso))
                                : "—"}
                            </span>
                          ) : (
                            <InputFecha
                              value={x.draftFecha}
                              onChange={(v) =>
                                setUltimosAportes((prev) =>
                                  prev.map((u) =>
                                    u.distritoNumero === x.distritoNumero
                                      ? { ...u, draftFecha: v }
                                      : u
                                  )
                                )
                              }
                              className="h-8 px-2 border rounded-md"
                            />
                          )}
                          {!x.isEditing ? (
                            <button
                              type="button"
                              className="p-1 text-gray-500 hover:text-blue-600"
                              onClick={() =>
                                setUltimosAportes((prev) =>
                                  prev.map((u) =>
                                    u.distritoNumero === x.distritoNumero
                                      ? { ...u, isEditing: true }
                                      : u
                                  )
                                )
                              }
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                          ) : (
                            <>
                              <button
                                type="button"
                                className="p-1 text-green-600 hover:bg-green-50 rounded"
                                onClick={async () => {
                                  const iso = x.draftFecha.trim()
                                    ? parsearFechaSegura(x.draftFecha)?.toISOString() ?? null
                                    : null;
                                  if (x.draftFecha.trim() && !iso) {
                                    showMessage("error", "Fecha inválida.");
                                    return;
                                  }
                                  setUltimosAportes((prev) =>
                                    prev.map((u) =>
                                      u.distritoNumero === x.distritoNumero
                                        ? { ...u, saving: true }
                                        : u
                                    )
                                  );
                                  const res = await fetch(
                                    `/api/tesoreria/informe/${id}/ultimos-aportes`,
                                    {
                                      method: "PUT",
                                      headers: { "Content-Type": "application/json" },
                                      body: JSON.stringify({
                                        distritoNumero: x.distritoNumero,
                                        fechaOverride: iso,
                                      }),
                                    }
                                  );
                                  const j = await res.json().catch(() => ({}));
                                  setUltimosAportes((prev) =>
                                    prev.map((u) =>
                                      u.distritoNumero === x.distritoNumero
                                        ? {
                                            ...u,
                                            saving: false,
                                            isEditing: res.ok ? false : u.isEditing,
                                            fechaMostradaIso: res.ok
                                              ? (j.fechaOverride as string | null)
                                              : u.fechaMostradaIso,
                                          }
                                        : u
                                    )
                                  );
                                  if (!res.ok) {
                                    showMessage("error", j?.error || "No se pudo guardar.");
                                    return;
                                  }
                                  showMessage("ok", "Override guardado.");
                                }}
                              >
                                {x.saving ? (
                                  <RefreshCw className="w-4 h-4 animate-spin" />
                                ) : (
                                  <Check className="w-4 h-4" />
                                )}
                              </button>
                              <button
                                type="button"
                                className="p-1 text-gray-500 hover:bg-gray-100 rounded"
                                onClick={() =>
                                  setUltimosAportes((prev) =>
                                    prev.map((u) =>
                                      u.distritoNumero === x.distritoNumero
                                        ? {
                                            ...u,
                                            isEditing: false,
                                            draftFecha: u.fechaMostradaIso
                                              ? formatearFechaUTC(new Date(u.fechaMostradaIso))
                                              : "",
                                          }
                                        : u
                                    )
                                  )
                                }
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <span className="font-bold text-center w-full">CONCILIACIÓN FINANCIERA PROYECTADA</span>
          <span className="text-center text-sm text-gray-500">
            Período: del {formatPeriodoLargo(informe.fechaDesde, informe.fechaHasta)}
          </span>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {[
            { key: "banco", label: "I) SALDO Banco Rio Cta. Cte.", value: saldoBancoRio },
            { key: "fondo", label: "II) SALDO Fondo Fijo", value: saldoFondoFijo },
            { key: "cheques", label: "III) Cheques a depositar", value: chequesDepositar },
          ].map((row) => (
            <div key={row.key} className="flex items-center justify-between border-b pb-2">
              <span>{row.label} ................................................</span>
              <div className="flex items-center gap-2">
                {conciliacionEditing === row.key ? (
                  <Input
                    className="w-40 text-right"
                    value={concDraft}
                    onChange={(e) => setConcDraft(e.target.value)}
                  />
                ) : (
                  <span className="font-medium">$ {formatARS(row.value)}</span>
                )}
                {conciliacionEditing !== row.key ? (
                  <button
                    type="button"
                    className="p-1 text-gray-500 hover:text-blue-600"
                    onClick={() => {
                      setConciliacionEditing(row.key as "banco" | "fondo" | "cheques");
                      setConcDraft(String(row.value));
                    }}
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      className="p-1 text-green-600 hover:bg-green-50 rounded"
                      onClick={async () => {
                        const v = Number(concDraft);
                        if (Number.isNaN(v)) {
                          showMessage("error", "Importe inválido.");
                          return;
                        }
                        const payload: Record<string, number> = {};
                        if (row.key === "banco") payload.saldoBancoRioOverride = v;
                        if (row.key === "fondo") payload.saldoFondoFijoOverride = v;
                        if (row.key === "cheques") payload.chequesADepositar = v;
                        setSavingKey(`conc-${row.key}`);
                        const res = await fetch(`/api/tesoreria/informe/${id}/conciliacion`, {
                          method: "PUT",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify(payload),
                        });
                        const j = await res.json().catch(() => ({}));
                        setSavingKey(null);
                        if (!res.ok) {
                          showMessage("error", j?.error || "No se pudo guardar.");
                          return;
                        }
                        if (row.key === "banco") setSaldoBancoRio(Number(j.saldoBancoRioOverride ?? v));
                        if (row.key === "fondo") setSaldoFondoFijo(Number(j.saldoFondoFijoOverride ?? v));
                        if (row.key === "cheques") setChequesDepositar(Number(j.chequesADepositar ?? v));
                        setConciliacionEditing(null);
                        showMessage("ok", "Conciliación actualizada.");
                      }}
                    >
                      {savingKey === `conc-${row.key}` ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <Check className="w-4 h-4" />
                      )}
                    </button>
                    <button
                      type="button"
                      className="p-1 text-gray-500 hover:bg-gray-100 rounded"
                      onClick={() => setConciliacionEditing(null)}
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
          <div className="flex items-center justify-between pt-1 font-bold">
            <span>TOTAL: ............................................................</span>
            <span>$ {formatARS(totalConciliacion)}</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <span className="font-semibold text-lg">
            IV) COMPROMISOS A PAGAR: .... $ {formatARS(totalCompromisos)}
          </span>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="border rounded-lg overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-gray-600">
                  <th className="p-2 pl-3 w-20">N°</th>
                  <th className="p-2">CONCEPTO</th>
                  <th className="p-2 text-right">IMPORTE</th>
                  <th className="p-2 pr-3 text-right w-36">ACCIONES</th>
                </tr>
              </thead>
              <tbody>
                {compromisos.map((c, idx) => (
                  <tr key={`${c.id ?? "new"}-${idx}`} className="border-b">
                    <td className="p-2 pl-3">
                      {c.isEditing ? (
                        <Input
                          value={c.draftNumero}
                          onChange={(e) =>
                            setCompromisos((prev) =>
                              prev.map((x, i) =>
                                i === idx ? { ...x, draftNumero: e.target.value } : x
                              )
                            )
                          }
                        />
                      ) : (
                        c.numero || "—"
                      )}
                    </td>
                    <td className="p-2">
                      {c.isEditing ? (
                        <Input
                          value={c.draftConcepto}
                          onChange={(e) =>
                            setCompromisos((prev) =>
                              prev.map((x, i) =>
                                i === idx ? { ...x, draftConcepto: e.target.value } : x
                              )
                            )
                          }
                        />
                      ) : (
                        c.concepto
                      )}
                    </td>
                    <td className="p-2 text-right">
                      {c.isEditing ? (
                        <Input
                          className="text-right"
                          value={c.draftImporte}
                          onChange={(e) =>
                            setCompromisos((prev) =>
                              prev.map((x, i) =>
                                i === idx ? { ...x, draftImporte: e.target.value } : x
                              )
                            )
                          }
                        />
                      ) : (
                        formatARS(c.importe)
                      )}
                    </td>
                    <td className="p-2 pr-3">
                      <div className="flex justify-end gap-1">
                        {!c.isEditing ? (
                          <>
                            <button
                              type="button"
                              className="p-1.5 text-gray-500 hover:text-blue-600"
                              onClick={() =>
                                setCompromisos((prev) =>
                                  prev.map((x, i) => (i === idx ? { ...x, isEditing: true } : x))
                                )
                              }
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              className="p-1.5 text-red-500 hover:bg-red-50 rounded"
                              onClick={async () => {
                                if (!confirm("¿Eliminar compromiso?")) return;
                                if (c.id) {
                                  setSavingKey(`co-del-${c.id}`);
                                  const res = await fetch(
                                    `/api/tesoreria/informe/${id}/compromisos/${c.id}`,
                                    { method: "DELETE" }
                                  );
                                  setSavingKey(null);
                                  if (!res.ok) {
                                    const j = await res.json().catch(() => ({}));
                                    showMessage("error", j?.error || "No se pudo eliminar.");
                                    return;
                                  }
                                }
                                setCompromisos((prev) => prev.filter((_, i) => i !== idx));
                                showMessage("ok", "Compromiso eliminado.");
                              }}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              className="p-1.5 text-green-600 hover:bg-green-50 rounded"
                              onClick={async () => {
                                const concepto = c.draftConcepto.trim();
                                const importe = Number(c.draftImporte);
                                if (!concepto || Number.isNaN(importe)) {
                                  showMessage("error", "Concepto o importe inválido.");
                                  return;
                                }
                                const payload = {
                                  numero: c.draftNumero.trim() || null,
                                  concepto,
                                  importe,
                                  orden: c.orden,
                                };
                                setSavingKey(`co-save-${idx}`);
                                const res = c.id
                                  ? await fetch(
                                      `/api/tesoreria/informe/${id}/compromisos/${c.id}`,
                                      {
                                        method: "PUT",
                                        headers: { "Content-Type": "application/json" },
                                        body: JSON.stringify(payload),
                                      }
                                    )
                                  : await fetch(`/api/tesoreria/informe/${id}/compromisos`, {
                                      method: "POST",
                                      headers: { "Content-Type": "application/json" },
                                      body: JSON.stringify(payload),
                                    });
                                setSavingKey(null);
                                const j = await res.json().catch(() => ({}));
                                if (!res.ok) {
                                  showMessage("error", j?.error || "No se pudo guardar.");
                                  return;
                                }
                                setCompromisos((prev) =>
                                  prev.map((x, i) =>
                                    i === idx
                                      ? {
                                          ...x,
                                          id: j.id ?? x.id,
                                          numero: j.numero ?? "",
                                          concepto: j.concepto ?? concepto,
                                          importe: Number(j.importe ?? importe),
                                          isEditing: false,
                                          draftNumero: j.numero ?? "",
                                          draftConcepto: j.concepto ?? concepto,
                                          draftImporte: String(Number(j.importe ?? importe)),
                                        }
                                      : x
                                  )
                                );
                                showMessage("ok", "Compromiso guardado.");
                              }}
                            >
                              {savingKey === `co-save-${idx}` ? (
                                <RefreshCw className="w-4 h-4 animate-spin" />
                              ) : (
                                <Check className="w-4 h-4" />
                              )}
                            </button>
                            <button
                              type="button"
                              className="p-1.5 text-gray-500 hover:bg-gray-100 rounded"
                              onClick={() =>
                                setCompromisos((prev) =>
                                  prev.map((x, i) =>
                                    i === idx
                                      ? {
                                          ...x,
                                          isEditing: false,
                                          draftNumero: x.numero,
                                          draftConcepto: x.concepto,
                                          draftImporte: String(x.importe),
                                        }
                                      : x
                                  )
                                )
                              }
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Button
            type="button"
            variant="outline"
            onClick={() =>
              setCompromisos((prev) => [
                ...prev,
                {
                  id: null,
                  numero: "",
                  concepto: "",
                  importe: 0,
                  orden: prev.length,
                  isEditing: true,
                  draftNumero: "",
                  draftConcepto: "",
                  draftImporte: "0",
                },
              ])
            }
          >
            <Plus className="w-4 h-4 mr-2" />
            Agregar Compromiso
          </Button>
          <input
            ref={compromisosExcelRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void importarCompromisosExcel(file);
            }}
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => compromisosExcelRef.current?.click()}
            disabled={savingKey === "co-import"}
          >
            {savingKey === "co-import" ? "Importando..." : "Importar Excel (inteligente)"}
          </Button>
          {detalleImportacionCompromisos && (
            <div className="w-full rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              <div className="flex items-center justify-between gap-3">
                <span className="font-medium">
                  No detectados en Excel ({detalleImportacionCompromisos.length}):
                </span>
                <button
                  type="button"
                  className="text-amber-800 hover:text-amber-950 underline"
                  onClick={() => setDetalleImportacionCompromisos(null)}
                >
                  Cerrar
                </button>
              </div>
              <p className="mt-1">
                {detalleImportacionCompromisos.join(" | ")}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <div className="text-xl font-bold">
            SALDO:{" "}
            <span className={saldoFinal >= 0 ? "text-green-700" : "text-red-700"}>
              $ {formatARS(saldoFinal)}
            </span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <span className="font-semibold text-lg">Text Boxes</span>
        </CardHeader>
        <CardContent className="space-y-3">
          {textBoxes.map((tb, idx) => (
            <div key={`${tb.id ?? "new"}-${idx}`} className="border rounded-md p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <p className="font-semibold text-sm mb-2">{tb.numero}))</p>
                  {!tb.isEditing ? (
                    <p className="text-sm whitespace-pre-wrap">{tb.contenido}</p>
                  ) : (
                    <textarea
                      className="w-full min-h-[90px] rounded-md border p-2 text-sm"
                      value={tb.draftContenido}
                      onChange={(e) =>
                        setTextBoxes((prev) =>
                          prev.map((x, i) =>
                            i === idx ? { ...x, draftContenido: e.target.value } : x
                          )
                        )
                      }
                    />
                  )}
                </div>
                <div className="flex gap-1">
                  {!tb.isEditing ? (
                    <>
                      <button
                        type="button"
                        className="p-1.5 text-gray-500 hover:text-blue-600"
                        onClick={() =>
                          setTextBoxes((prev) =>
                            prev.map((x, i) => (i === idx ? { ...x, isEditing: true } : x))
                          )
                        }
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        className="p-1.5 text-red-500 hover:bg-red-50 rounded"
                        onClick={async () => {
                          if (!confirm("¿Eliminar text box?")) return;
                          if (tb.id) {
                            setSavingKey(`tb-del-${tb.id}`);
                            const res = await fetch(
                              `/api/tesoreria/informe/${id}/textboxes/${tb.id}`,
                              { method: "DELETE" }
                            );
                            setSavingKey(null);
                            if (!res.ok) {
                              const j = await res.json().catch(() => ({}));
                              showMessage("error", j?.error || "No se pudo eliminar.");
                              return;
                            }
                          }
                          setTextBoxes((prev) => prev.filter((_, i) => i !== idx));
                          showMessage("ok", "Text box eliminado.");
                        }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        className="p-1.5 text-green-600 hover:bg-green-50 rounded"
                        onClick={async () => {
                          const contenido = tb.draftContenido.trim();
                          if (!contenido) {
                            showMessage("error", "El contenido no puede quedar vacío.");
                            return;
                          }
                          setSavingKey(`tb-save-${idx}`);
                          const res = tb.id
                            ? await fetch(`/api/tesoreria/informe/${id}/textboxes/${tb.id}`, {
                                method: "PUT",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ contenido }),
                              })
                            : await fetch(`/api/tesoreria/informe/${id}/textboxes`, {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({
                                  numero: tb.numero,
                                  contenido,
                                  orden: tb.orden,
                                }),
                              });
                          setSavingKey(null);
                          const j = await res.json().catch(() => ({}));
                          if (!res.ok) {
                            showMessage("error", j?.error || "No se pudo guardar.");
                            return;
                          }
                          setTextBoxes((prev) =>
                            prev.map((x, i) =>
                              i === idx
                                ? {
                                    ...x,
                                    id: j.id ?? x.id,
                                    contenido: j.contenido ?? contenido,
                                    draftContenido: j.contenido ?? contenido,
                                    isEditing: false,
                                  }
                                : x
                            )
                          );
                          showMessage("ok", "Text box guardado.");
                        }}
                      >
                        {savingKey === `tb-save-${idx}` ? (
                          <RefreshCw className="w-4 h-4 animate-spin" />
                        ) : (
                          <Check className="w-4 h-4" />
                        )}
                      </button>
                      <button
                        type="button"
                        className="p-1.5 text-gray-500 hover:bg-gray-100 rounded"
                        onClick={() =>
                          setTextBoxes((prev) =>
                            prev.map((x, i) =>
                              i === idx
                                ? {
                                    ...x,
                                    isEditing: false,
                                    draftContenido: x.contenido,
                                  }
                                : x
                            )
                          )
                        }
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}

          <Button
            type="button"
            variant="outline"
            onClick={() => {
              const nextNumero =
                textBoxes.length > 0
                  ? Math.max(...textBoxes.map((x) => x.numero)) + 1
                  : 1;
              setTextBoxes((prev) => [
                ...prev,
                {
                  id: null,
                  numero: nextNumero,
                  contenido: "",
                  orden: prev.length,
                  isEditing: true,
                  draftContenido: "",
                },
              ]);
            }}
          >
            <Plus className="w-4 h-4 mr-2" />
            Agregar Text Box
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
