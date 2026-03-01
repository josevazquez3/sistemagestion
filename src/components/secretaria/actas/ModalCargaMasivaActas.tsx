"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import {
  FolderUp,
  Loader2,
  CheckCircle2,
  XCircle,
} from "lucide-react";

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_FILES = 50;

type FileItem = {
  file: File;
  name: string;
  size: number;
  status: "pendiente" | "invalido";
  error?: string;
};

type DuplicadoItem = { nombreArchivo: string; id: number };

type RowPaso3 = {
  name: string;
  file: File;
  titulo: string;
  fechaActa: string;
};

type ResultadoItem = { name: string; status: "pending" | "ok" | "error"; message?: string };

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function nombreSinExtension(name: string): string {
  return name.replace(/\.docx$/i, "") || name;
}

type ModalCargaMasivaActasProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  showMessage: (type: "ok" | "error", text: string) => void;
};

export function ModalCargaMasivaActas({
  open,
  onOpenChange,
  onSuccess,
  showMessage,
}: ModalCargaMasivaActasProps) {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [fileList, setFileList] = useState<FileItem[]>([]);
  const [duplicadosResult, setDuplicadosResult] = useState<{
    duplicados: DuplicadoItem[];
    nuevos: string[];
  } | null>(null);
  const [selectedNames, setSelectedNames] = useState<Set<string>>(new Set());
  const [rowsPaso3, setRowsPaso3] = useState<RowPaso3[]>([]);
  const [loadingDuplicados, setLoadingDuplicados] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [results, setResults] = useState<ResultadoItem[]>([]);

  const validFiles = fileList.filter((f) => f.status === "pendiente");
  const validCount = validFiles.length;
  const selectedCount = selectedNames.size;
  const duplicadosMap = new Map(
    duplicadosResult?.duplicados?.map((d) => [d.nombreArchivo, d]) ?? []
  );
  const nuevosCount = duplicadosResult?.nuevos?.length ?? 0;
  const duplicadosCount = duplicadosResult?.duplicados?.length ?? 0;

  const reset = useCallback(() => {
    setStep(1);
    setFileList([]);
    setDuplicadosResult(null);
    setSelectedNames(new Set());
    setRowsPaso3([]);
    setResults([]);
  }, []);

  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (!next) reset();
      onOpenChange(next);
    },
    [onOpenChange, reset]
  );

  const addFiles = useCallback((files: FileList | null) => {
    if (!files?.length) return;
    const next: FileItem[] = [];
    const currentNames = new Set(fileList.map((f) => f.name.toLowerCase()));
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const name = file.name;
      const nameLower = name.toLowerCase();
      if (next.length + fileList.length >= MAX_FILES) {
        showMessage("error", `Máximo ${MAX_FILES} archivos por carga.`);
        break;
      }
      if (currentNames.has(nameLower) || next.some((n) => n.name.toLowerCase() === nameLower)) {
        continue;
      }
      currentNames.add(nameLower);
      let status: "pendiente" | "invalido" = "pendiente";
      let error: string | undefined;
      if (!nameLower.endsWith(".docx")) {
        status = "invalido";
        error = "Formato no permitido";
      } else if (file.size > MAX_FILE_SIZE) {
        status = "invalido";
        error = "Supera 10 MB";
      }
      next.push({ file, name, size: file.size, status, error });
    }
    setFileList((prev) => [...prev, ...next].slice(0, MAX_FILES));
  }, [fileList, showMessage]);

  const goPaso2 = useCallback(async () => {
    if (validCount === 0) return;
    setLoadingDuplicados(true);
    try {
      const nombres = encodeURIComponent(validFiles.map((f) => f.name).join(","));
      const res = await fetch(
        `/api/secretaria/actas/validar-duplicados?nombres=${nombres}`
      );
      const data = await res.json();
      if (!res.ok) {
        showMessage("error", data.error || "Error al validar duplicados");
        return;
      }
      setDuplicadosResult({ duplicados: data.duplicados ?? [], nuevos: data.nuevos ?? [] });
      const selected = new Set<string>();
      (data.nuevos ?? []).forEach((n: string) => selected.add(n));
      setSelectedNames(selected);
      setStep(2);
    } finally {
      setLoadingDuplicados(false);
    }
  }, [validFiles, validCount, showMessage]);

  const goPaso3 = useCallback(() => {
    const hoy = new Date();
    const fechaDefault = `${String(hoy.getDate()).padStart(2, "0")}/${String(hoy.getMonth() + 1).padStart(2, "0")}/${hoy.getFullYear()}`;
    const rows: RowPaso3[] = validFiles
      .filter((f) => selectedNames.has(f.name))
      .map((f) => ({
        name: f.name,
        file: f.file,
        titulo: nombreSinExtension(f.name),
        fechaActa: fechaDefault,
      }));
    setRowsPaso3(rows);
    setStep(3);
  }, [validFiles, selectedNames]);

  const toggleSelect = useCallback((name: string) => {
    setSelectedNames((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }, []);

  const setTitulo = useCallback((name: string, titulo: string) => {
    setRowsPaso3((prev) =>
      prev.map((r) => (r.name === name ? { ...r, titulo } : r))
    );
  }, []);

  const setFechaActa = useCallback((name: string, fechaActa: string) => {
    setRowsPaso3((prev) =>
      prev.map((r) => (r.name === name ? { ...r, fechaActa } : r))
    );
  }, []);

  const allHaveTituloYFecha = rowsPaso3.every(
    (r) => r.titulo.trim() && /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(r.fechaActa)
  );
  const canCargar = rowsPaso3.length >= 1 && allHaveTituloYFecha;

  const ejecutarCarga = useCallback(async () => {
    if (!canCargar) return;
    setUploading(true);
    const resList: ResultadoItem[] = rowsPaso3.map((r) => ({
      name: r.name,
      status: "pending" as const,
    }));
    setResults(resList);

    let okCount = 0;
    for (let i = 0; i < rowsPaso3.length; i++) {
      const r = rowsPaso3[i];
      try {
        const form = new FormData();
        form.set("titulo", r.titulo.trim());
        form.set("fechaActa", r.fechaActa);
        form.set("file", r.file);
        const res = await fetch("/api/secretaria/actas", { method: "POST", body: form });
        const data = await res.json();
        if (res.ok) {
          resList[i] = { name: r.name, status: "ok" };
          okCount++;
        } else {
          resList[i] = { name: r.name, status: "error", message: data.error || "Error" };
        }
      } catch {
        resList[i] = { name: r.name, status: "error", message: "Error de conexión" };
      }
      setResults([...resList]);
    }

    setUploading(false);
    setStep(4);

    if (okCount > 0) {
      try {
        await fetch("/api/secretaria/actas/auditoria-carga-masiva", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cantidad: okCount }),
        });
      } catch {
        // Ignorar si falla el registro de auditoría
      }
    }
  }, [rowsPaso3, canCargar]);

  const handleCerrar = useCallback(() => {
    handleOpenChange(false);
    onSuccess();
  }, [handleOpenChange, onSuccess]);

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Carga masiva de actas</DialogTitle>
          <DialogDescription>
            Paso {step} de 4:{" "}
            {step === 1 && "Selección de archivos"}
            {step === 2 && "Validación de duplicados"}
            {step === 3 && "Datos del acta y carga"}
            {step === 4 && "Resultado"}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto space-y-4 py-2">
          {step === 1 && (
            <>
              <div
                className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center bg-gray-50 hover:bg-gray-100 transition-colors cursor-pointer"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  addFiles(e.dataTransfer.files);
                }}
                onClick={() => document.getElementById("carga-masiva-actas-input")?.click()}
              >
                <input
                  id="carga-masiva-actas-input"
                  type="file"
                  accept=".docx"
                  multiple
                  className="hidden"
                  onChange={(e) => addFiles(e.target.files)}
                />
                <p className="text-gray-600">
                  Arrastrá los archivos .docx o hacé clic para seleccionar
                </p>
                <p className="text-sm text-gray-500 mt-1">
                  Máximo {MAX_FILES} archivos, 10 MB cada uno
                </p>
              </div>

              {fileList.length > 0 && (
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Archivo</TableHead>
                        <TableHead>Tamaño</TableHead>
                        <TableHead>Estado</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {fileList.map((f) => (
                        <TableRow
                          key={f.name}
                          className={f.status === "invalido" ? "bg-red-50" : ""}
                        >
                          <TableCell className="font-medium">{f.name}</TableCell>
                          <TableCell>{formatSize(f.size)}</TableCell>
                          <TableCell>
                            {f.status === "pendiente" ? (
                              <span className="text-gray-600">Pendiente</span>
                            ) : (
                              <span className="text-red-600">{f.error}</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              <DialogFooter>
                <Button
                  disabled={validCount < 1}
                  onClick={goPaso2}
                >
                  {loadingDuplicados ? <Loader2 className="h-4 w-4 animate-spin" /> : "Siguiente"}
                </Button>
              </DialogFooter>
            </>
          )}

          {step === 2 && (
            <>
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10"></TableHead>
                      <TableHead>Archivo</TableHead>
                      <TableHead>Estado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {validFiles.map((f) => {
                      const esNuevo = duplicadosResult?.nuevos?.includes(f.name);
                      return (
                        <TableRow key={f.name}>
                          <TableCell>
                            <Checkbox
                              checked={selectedNames.has(f.name)}
                              onCheckedChange={() => toggleSelect(f.name)}
                            />
                          </TableCell>
                          <TableCell className="font-medium">{f.name}</TableCell>
                          <TableCell>
                            {esNuevo ? (
                              <span className="text-green-600">Nuevo</span>
                            ) : (
                              <span className="text-orange-600">Duplicado</span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
              <p className="text-sm text-gray-600">
                {nuevosCount} nuevos | {duplicadosCount} duplicados | {selectedCount} seleccionados
              </p>
              <DialogFooter>
                <Button variant="outline" onClick={() => setStep(1)}>
                  Anterior
                </Button>
                <Button disabled={selectedCount < 1} onClick={goPaso3}>
                  Siguiente
                </Button>
              </DialogFooter>
            </>
          )}

          {step === 3 && (
            <>
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Archivo</TableHead>
                      <TableHead>Título del acta</TableHead>
                      <TableHead>Fecha del acta</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rowsPaso3.map((r) => (
                      <TableRow key={r.name}>
                        <TableCell className="font-medium text-gray-600">{r.name}</TableCell>
                        <TableCell>
                          <input
                            type="text"
                            value={r.titulo}
                            onChange={(e) => setTitulo(r.name, e.target.value)}
                            className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
                          />
                        </TableCell>
                        <TableCell>
                          <input
                            type="text"
                            value={r.fechaActa}
                            onChange={(e) => setFechaActa(r.name, e.target.value)}
                            placeholder="DD/MM/YYYY"
                            className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setStep(2)}>
                  Anterior
                </Button>
                <Button
                  disabled={!canCargar || uploading}
                  onClick={ejecutarCarga}
                >
                  {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Cargar"}
                </Button>
              </DialogFooter>
            </>
          )}

          {step === 4 && (
            <>
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Archivo</TableHead>
                      <TableHead>Estado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {results.map((r) => (
                      <TableRow key={r.name}>
                        <TableCell className="font-medium">{r.name}</TableCell>
                        <TableCell>
                          {r.status === "pending" && (
                            <span className="text-gray-500">Cargando...</span>
                          )}
                          {r.status === "ok" && (
                            <span className="text-green-600 flex items-center gap-1">
                              <CheckCircle2 className="h-4 w-4" /> Cargado
                            </span>
                          )}
                          {r.status === "error" && (
                            <span className="text-red-600 flex items-center gap-1">
                              <XCircle className="h-4 w-4" /> Error
                              {r.message ? `: ${r.message}` : ""}
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <DialogFooter>
                <Button onClick={handleCerrar}>Cerrar</Button>
              </DialogFooter>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
