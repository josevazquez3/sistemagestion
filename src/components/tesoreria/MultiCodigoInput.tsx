"use client";

import { useState } from "react";
import { Hash, Plus, X } from "lucide-react";

type MultiCodigoInputProps = {
  codigos: string[];
  onCodigosChange: (codigos: string[]) => void;
  onSave: (codigos: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
};

export function MultiCodigoInput({
  codigos,
  onCodigosChange,
  onSave,
  placeholder = "Agregar código...",
  disabled = false,
}: MultiCodigoInputProps) {
  const [inputValue, setInputValue] = useState("");

  const agregar = (valor: string) => {
    const cod = valor.trim();
    if (!cod) return;
    if (codigos.includes(cod)) return;
    const next = [...codigos, cod];
    onCodigosChange(next);
    onSave(next);
    setInputValue("");
  };

  const quitar = (cod: string) => {
    const next = codigos.filter((c) => c !== cod);
    onCodigosChange(next);
    onSave(next);
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {codigos.map((cod) => (
        <span
          key={cod}
          className="inline-flex items-center gap-1 bg-slate-100 text-slate-700 text-sm px-3 py-1.5 rounded-lg border border-slate-300"
        >
          <Hash className="w-3.5 h-3.5 text-slate-500" />
          {cod}
          <button
            type="button"
            onClick={() => quitar(cod)}
            className="text-slate-400 hover:text-red-600 p-0.5 rounded"
            title="Quitar código"
            disabled={disabled}
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </span>
      ))}
      <div className="flex items-center gap-1">
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder={placeholder}
          className="border rounded px-2 py-1.5 text-sm w-36"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              agregar(inputValue);
            }
          }}
          disabled={disabled}
        />
        <button
          type="button"
          onClick={() => agregar(inputValue)}
          className="flex items-center gap-1 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-sm px-2 py-1.5 rounded"
          title="Agregar código"
          disabled={disabled}
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
