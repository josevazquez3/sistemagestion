"use client";

import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { FileUp, FileText, Image, X } from "lucide-react";
import { cn } from "@/lib/utils";

const ALLOWED_ACCEPT = "application/pdf,image/jpeg,image/jpg";
const MAX_SIZE = 10 * 1024 * 1024; // 10 MB

export interface ArchivoPreview {
  file: File;
  id: string;
  error?: string;
}

export interface SubirCertificadosProps {
  value: ArchivoPreview[];
  onChange: (files: ArchivoPreview[]) => void;
  disabled?: boolean;
  maxFiles?: number;
}

export function SubirCertificados({
  value,
  onChange,
  disabled = false,
  maxFiles = 5,
}: SubirCertificadosProps) {
  const [arrastrando, setArrastrando] = useState(false);

  const validar = useCallback((file: File): string | null => {
    const t = file.type?.toLowerCase();
    if (t !== "application/pdf" && t !== "image/jpeg" && t !== "image/jpg") {
      return "Solo se permiten PDF y JPG";
    }
    if (file.size > MAX_SIZE) return "El archivo supera 10 MB";
    return null;
  }, []);

  const agregar = useCallback(
    (files: FileList | File[]) => {
      const list = Array.from(files);
      const nuevos: ArchivoPreview[] = [];
      for (const file of list) {
        if (value.length + nuevos.length >= maxFiles) break;
        const err = validar(file);
        nuevos.push({ file, id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, error: err ?? undefined });
      }
      if (nuevos.length) onChange([...value, ...nuevos]);
    },
    [value, maxFiles, validar, onChange]
  );

  const quitar = useCallback(
    (id: string) => {
      onChange(value.filter((a) => a.id !== id));
    },
    [value, onChange]
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setArrastrando(false);
      if (disabled) return;
      agregar(e.dataTransfer.files);
    },
    [disabled, agregar]
  );

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setArrastrando(true);
  }, []);

  const onDragLeave = useCallback(() => {
    setArrastrando(false);
  }, []);

  const onInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files?.length) agregar(files);
      e.target.value = "";
    },
    [agregar]
  );

  return (
    <div className="space-y-3">
      <div
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        className={cn(
          "border-2 border-dashed rounded-xl p-6 text-center transition-colors",
          arrastrando ? "border-green-400 bg-green-50" : "border-gray-200 bg-gray-50/50",
          disabled && "opacity-60 pointer-events-none"
        )}
      >
        <input
          type="file"
          accept={ALLOWED_ACCEPT}
          multiple
          onChange={onInputChange}
          className="hidden"
          id="certificados-upload"
          disabled={disabled}
        />
        <label htmlFor="certificados-upload" className="cursor-pointer flex flex-col items-center gap-2">
          <FileUp className="h-10 w-10 text-gray-400" />
          <span className="text-sm text-gray-600">
            Arrastrá archivos aquí o <span className="text-green-600 font-medium">elegir archivos</span>
          </span>
          <span className="text-xs text-gray-500">Solo PDF y JPG. Máx. 10 MB por archivo.</span>
        </label>
      </div>

      {value.length > 0 && (
        <ul className="space-y-2">
          {value.map((a) => (
            <li
              key={a.id}
              className={cn(
                "flex items-center gap-3 rounded-lg border p-3",
                a.error ? "border-red-200 bg-red-50" : "border-gray-200 bg-white"
              )}
            >
              {a.file.type?.startsWith("image/") ? (
                <Image className="h-8 w-8 text-amber-600 shrink-0" />
              ) : (
                <FileText className="h-8 w-8 text-red-600 shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800 truncate">{a.file.name}</p>
                <p className="text-xs text-gray-500">
                  {(a.file.size / 1024).toFixed(1)} KB
                  {a.error && <span className="text-red-600 ml-1">— {a.error}</span>}
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => quitar(a.id)}
                disabled={disabled}
                className="shrink-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
