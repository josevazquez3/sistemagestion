"use client";

import { useState, useEffect, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type CuentaOption = { id: number; codigo: string; codOperativo?: string | null; nombre: string };

type SelectorCuentaProps = {
  cuentaId: number | null;
  codigoInicial?: string;
  nombreInicial?: string;
  onSelect: (cuentaId: number | null, codigo: string, nombre: string) => void;
  placeholderCodigo?: string;
  placeholderNombre?: string;
};

const DEBOUNCE_MS = 200;

export function SelectorCuenta({
  cuentaId,
  codigoInicial = "",
  nombreInicial = "",
  onSelect,
  placeholderCodigo = "Código",
  placeholderNombre = "Nombre",
}: SelectorCuentaProps) {
  const [codigo, setCodigo] = useState(codigoInicial);
  const [nombre, setNombre] = useState(nombreInicial);
  const [cuentas, setCuentas] = useState<CuentaOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [noEncontrado, setNoEncontrado] = useState(false);

  const fetchTodas = useCallback(async () => {
    const res = await fetch("/api/tesoreria/cuentas-bancarias/todas");
    const data = await res.json();
    if (res.ok) setCuentas(data as CuentaOption[]);
  }, []);

  useEffect(() => {
    fetchTodas();
  }, [fetchTodas]);

  useEffect(() => {
    setCodigo(codigoInicial);
    setNombre(nombreInicial);
  }, [cuentaId, codigoInicial, nombreInicial]);

  const buscarPorCodigo = useCallback(
    (c: string) => {
      const cTrim = c.trim();
      if (!cTrim) {
        onSelect(null, "", "");
        setNombre("");
        setNoEncontrado(false);
        return;
      }
      const found = cuentas.find((x) => x.codigo.toLowerCase() === cTrim.toLowerCase());
      if (found) {
        onSelect(found.id, found.codigo, found.nombre);
        setNombre(found.nombre);
        setNoEncontrado(false);
      } else {
        setNoEncontrado(true);
        onSelect(null, cTrim, nombre);
      }
    },
    [cuentas, nombre, onSelect]
  );

  const buscarPorNombre = useCallback(
    (n: string) => {
      const nTrim = n.trim();
      if (!nTrim) {
        onSelect(null, codigo, "");
        setCodigo(codigo);
        setNoEncontrado(false);
        return;
      }
      const found = cuentas.find((x) => x.nombre.toLowerCase().includes(nTrim.toLowerCase()));
      if (found) {
        onSelect(found.id, found.codigo, found.nombre);
        setCodigo(found.codigo);
        setNoEncontrado(false);
      } else {
        setNoEncontrado(true);
        onSelect(null, codigo, nTrim);
      }
    },
    [cuentas, codigo, onSelect]
  );

  useEffect(() => {
    if (!codigo.trim()) return;
    const t = setTimeout(() => {
      setLoading(true);
      buscarPorCodigo(codigo);
      setLoading(false);
    }, DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [codigo]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!nombre.trim()) return;
    const t = setTimeout(() => {
      setLoading(true);
      buscarPorNombre(nombre);
      setLoading(false);
    }, DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [nombre]); // eslint-disable-line react-hooks/exhaustive-deps

  const cuentaSeleccionada = cuentaId != null ? cuentas.find((x) => x.id === cuentaId) : null;

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2 items-end">
        <div>
          <Label className="text-xs">Código cuenta</Label>
          <Input
            value={codigo}
            onChange={(e) => setCodigo(e.target.value)}
            placeholder={placeholderCodigo}
            className="mt-0.5 h-8"
          />
        </div>
        <div>
          <Label className="text-xs">Nombre</Label>
          <Input
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder={placeholderNombre}
            className="mt-0.5 h-8"
          />
        </div>
      </div>
      {cuentaSeleccionada && (
        <div className="text-sm text-gray-600">
          <span className="font-medium">{cuentaSeleccionada.codigo}</span>
          {cuentaSeleccionada.codOperativo && (
            <span className="text-gray-400 ml-1">({cuentaSeleccionada.codOperativo})</span>
          )}
          <span className="ml-2">{cuentaSeleccionada.nombre}</span>
        </div>
      )}
      {noEncontrado && (codigo.trim() || nombre.trim()) && (
        <p className="text-xs text-red-600">Cuenta no encontrada</p>
      )}
    </div>
  );
}
