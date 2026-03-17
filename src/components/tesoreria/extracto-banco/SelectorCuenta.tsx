"use client";

import { useState, useEffect, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export type CuentaOption = { id: number; codigo: string; codOperativo?: string | null; nombre: string };

type SelectorCuentaProps = {
  cuentaId: number | null;
  codigoInicial?: string;
  nombreInicial?: string;
  onSelect: (cuentaId: number | null, codigo: string, nombre: string) => void;
  placeholderCodigo?: string;
  placeholderNombre?: string;
  /** Código operativo del movimiento (Ref.) para vincular o crear variante */
  codOperativoRef?: string | null;
  showMessage?: (tipo: "ok" | "error", text: string) => void;
};

const DEBOUNCE_MS = 400;

export function SelectorCuenta({
  cuentaId,
  codigoInicial = "",
  nombreInicial = "",
  onSelect,
  placeholderCodigo = "Código",
  placeholderNombre = "Nombre",
  codOperativoRef,
  showMessage,
}: SelectorCuentaProps) {
  const [codigo, setCodigo] = useState(codigoInicial);
  const [nombre, setNombre] = useState(nombreInicial);
  const [cuentas, setCuentas] = useState<CuentaOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [noEncontrado, setNoEncontrado] = useState(false);
  const [cuentaEncontrada, setCuentaEncontrada] = useState(false);
  const [modalCrearOpen, setModalCrearOpen] = useState(false);
  const [nextCodigo, setNextCodigo] = useState("");
  const [creando, setCreando] = useState(false);

  const fetchTodas = useCallback(async () => {
    const res = await fetch("/api/tesoreria/cuentas-bancarias/todas");
    const data = await res.json();
    if (res.ok) setCuentas(Array.isArray(data) ? data : data?.data ?? []);
  }, []);

  useEffect(() => {
    fetchTodas();
  }, [fetchTodas]);

  useEffect(() => {
    setCodigo(codigoInicial);
    setNombre(nombreInicial);
  }, [cuentaId, codigoInicial, nombreInicial]);

  const buscarPorCodigo = useCallback(
    async (c: string) => {
      const cTrim = c.trim();
      if (!cTrim) {
        onSelect(null, "", "");
        setNombre("");
        setNoEncontrado(false);
        setCuentaEncontrada(false);
        return;
      }
      setLoading(true);
      setNoEncontrado(false);
      setCuentaEncontrada(false);

      const byCodigo = cuentas.find((x) => x.codigo.toLowerCase() === cTrim.toLowerCase());
      const byCodOp = codOperativoRef
        ? cuentas.find(
            (x) => x.codOperativo && x.codOperativo.trim().toLowerCase() === cTrim.toLowerCase()
          )
        : null;
      const found = byCodigo ?? byCodOp ?? null;

      if (found) {
        setNombre(found.nombre);
        setCuentaEncontrada(true);
        const codOpRef = (codOperativoRef ?? "").trim() || null;
        const variant = codOpRef
          ? cuentas.find(
              (x) =>
                x.codigo === found.codigo &&
                (x.codOperativo ?? "").trim() === codOpRef
            )
          : cuentas.find(
              (x) => x.codigo === found.codigo && (x.codOperativo === null || x.codOperativo === "")
            );
        if (variant) {
          onSelect(variant.id, variant.codigo, variant.nombre);
          setLoading(false);
          return;
        }
        try {
          const res = await fetch(`/api/tesoreria/cuentas-bancarias/${found.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ addCodOperativo: codOpRef }),
          });
          const data = await res.json();
          if (res.ok) {
            await fetchTodas();
            onSelect(found.id, data.codigo ?? found.codigo, data.nombre ?? found.nombre);
            showMessage?.("ok", "Código operativo vinculado a la cuenta.");
          } else {
            onSelect(found.id, found.codigo, found.nombre);
          }
        } catch {
          onSelect(found.id, found.codigo, found.nombre);
        }
        setLoading(false);
        return;
      }

      setNoEncontrado(true);
      onSelect(null, cTrim, nombre);
      setLoading(false);
    },
    [cuentas, codOperativoRef, nombre, onSelect, fetchTodas, showMessage]
  );

  const buscarPorNombre = useCallback(
    (n: string) => {
      const nTrim = n.trim();
      if (!nTrim) {
        onSelect(null, codigo, "");
        setNoEncontrado(false);
        return;
      }
      const found = cuentas.find((x) => x.nombre.toLowerCase().includes(nTrim.toLowerCase()));
      if (found) {
        onSelect(found.id, found.codigo, found.nombre);
        setCodigo(found.codigo);
        setCuentaEncontrada(true);
        setNoEncontrado(false);
      } else {
        setNoEncontrado(true);
        onSelect(null, codigo, nTrim);
      }
    },
    [cuentas, codigo, onSelect]
  );

  const handleCodigoBlur = useCallback(() => {
    if (!codigo.trim()) return;
    buscarPorCodigo(codigo);
  }, [codigo, buscarPorCodigo]);

  const handleCodigoKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleCodigoBlur();
      }
    },
    [handleCodigoBlur]
  );

  useEffect(() => {
    if (!nombre.trim()) return;
    const t = setTimeout(() => {
      setLoading(true);
      buscarPorNombre(nombre);
      setLoading(false);
    }, DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [nombre]); // eslint-disable-line react-hooks/exhaustive-deps

  const abrirModalCrear = useCallback(() => {
    const codigoUsuario = String(codigo ?? "").trim();
    if (codigoUsuario) {
      setNextCodigo(codigoUsuario);
    } else {
      fetch("/api/tesoreria/cuentas-bancarias/next-codigo")
        .then((r) => r.json())
        .then((d) => setNextCodigo(String(d.codigo ?? "01")))
        .catch(() => setNextCodigo("01"));
    }
    setModalCrearOpen(true);
  }, [codigo]);

  const handleCrearCuenta = useCallback(async () => {
    const nombreTrim = nombre.trim();
    if (!nombreTrim) {
      showMessage?.("error", "El nombre no puede quedar vacío.");
      return;
    }
    setCreando(true);
    try {
      const res = await fetch("/api/tesoreria/cuentas-bancarias", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          codigo: String(nextCodigo ?? "").trim() || "01",
          nombre: nombreTrim,
          codOperativo: (codOperativoRef ?? "").trim() || null,
          estado: "Activa",
        }),
      });
      const data = await res.json();
      if (res.ok && data.id) {
        await fetchTodas();
        onSelect(data.id, data.codigo, data.nombre);
        setCodigo(data.codigo);
        setNombre(data.nombre);
        setNoEncontrado(false);
        setCuentaEncontrada(true);
        setModalCrearOpen(false);
        showMessage?.(
          "ok",
          res.status === 200 ? "Código operativo agregado a la cuenta." : "Cuenta creada correctamente."
        );
      } else {
        showMessage?.("error", data.error || "Error al crear la cuenta.");
      }
    } catch {
      showMessage?.("error", "Error de conexión.");
    } finally {
      setCreando(false);
    }
  }, [nextCodigo, nombre, codOperativoRef, onSelect, fetchTodas, showMessage]);

  const cuentaSeleccionada = cuentaId != null ? cuentas.find((x) => x.id === cuentaId) : null;

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2 items-end">
        <div>
          <Label className="text-xs">Código cuenta</Label>
          <Input
            value={codigo}
            onChange={(e) => setCodigo(e.target.value)}
            onBlur={handleCodigoBlur}
            onKeyDown={handleCodigoKeyDown}
            placeholder={placeholderCodigo}
            className={`mt-0.5 h-8 ${cuentaEncontrada ? "border-green-400 bg-green-50/50" : ""}`}
          />
        </div>
        <div>
          <Label className="text-xs">Nombre</Label>
          <Input
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder={placeholderNombre}
            className={`mt-0.5 h-8 ${cuentaEncontrada ? "border-green-400 bg-green-50/50" : ""}`}
          />
        </div>
      </div>
      {cuentaSeleccionada && (
        <div className="text-sm text-gray-600">
          <span className="font-medium text-green-700">✓ </span>
          <span className="font-medium">{cuentaSeleccionada.codigo}</span>
          {cuentaSeleccionada.codOperativo && (
            <span className="text-gray-400 ml-1">({cuentaSeleccionada.codOperativo})</span>
          )}
          <span className="ml-2">{cuentaSeleccionada.nombre}</span>
        </div>
      )}
      {noEncontrado && (codigo.trim() || nombre.trim()) && !modalCrearOpen && (
        <div className="flex flex-col gap-1">
          <p className="text-xs text-amber-700">
            El código <strong>{codigo.trim()}</strong> no existe.
          </p>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              className="bg-green-600 hover:bg-green-700 text-white text-xs h-7"
              onClick={abrirModalCrear}
            >
              Crear nueva cuenta
            </Button>
            <button
              type="button"
              className="text-xs text-gray-500 hover:text-gray-700"
              onClick={() => {
                setNoEncontrado(false);
              }}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
      {loading && <p className="text-xs text-gray-400">Buscando…</p>}

      {modalCrearOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100]">
          <div className="bg-white rounded-lg p-4 shadow-xl max-w-sm w-full mx-4 border">
            <h4 className="font-semibold text-gray-900 mb-2">Crear nueva cuenta</h4>
            <p className="text-sm text-gray-600 mb-3">
              El código <strong>{codigo.trim()}</strong> no existe. ¿Crear una nueva cuenta?
            </p>
            <div className="space-y-2 mb-4">
              <div>
                <Label className="text-xs">Código</Label>
                <Input
                  value={nextCodigo}
                  readOnly
                  className="mt-0.5 h-8 bg-gray-50"
                />
              </div>
              <div>
                <Label className="text-xs">Nombre</Label>
                <Input
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  placeholder="Nombre de la cuenta"
                  className="mt-0.5 h-8"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setModalCrearOpen(false)}>
                Cancelar
              </Button>
              <Button
                size="sm"
                className="bg-green-600 hover:bg-green-700"
                onClick={handleCrearCuenta}
                disabled={creando}
              >
                {creando ? "Creando…" : "Crear cuenta"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
