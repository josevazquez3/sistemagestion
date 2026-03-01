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
  AlertTriangle,
} from "lucide-react";
import type { TipoNota } from "./types";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const MAX_FILES = 50;

type FileItem = {
  file: File;
  name: string;
  size: number;
  status: "pendiente" | "invalido";
  error?: string;
};

type DuplicadoItem = { nombreArchivo: string; id: number };

type ItemParaCargar = {
  name: string;
  file: File;
  isDuplicate: boolean;
  existingId?: number;
  tipoId: string;
  nombreModelo: string;
};

type ResultadoItem = { name: string; status: "ok" | "error"; message?: string };

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function nombreSinExtension(name: string): string {
  return name.replace(/\.docx$/i, "") || name;
}

type ModalCargaMasivaProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tiposActivos: TipoNota[];
  onSuccess: () => void;
  showMessage: (type: "ok" | "error", text: string) => void;
};

export function ModalCargaMasiva({
  open,
  onOpenChange,
  tiposActivos,
  onSuccess,
  showMessage,
}: ModalCargaMasivaProps) {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [fileList, setFileList] = useState<FileItem[]>([]);
  const [duplicadosResult, setDuplicadosResult] = useState<{
    duplicados: DuplicadoItem[];
    nuevos: string[];
  } | null>(null);
  const [selectedNames, setSelectedNames] = useState<Set<string>>(new Set());
  const [assignmentMode, setAssignmentMode] = useState<"same" | "individual">("same");
  const [tipoIdSame, setTipoIdSame] = useState("");
  const [perFileAssign, setPerFileAssign] = useState<Record<string, { tipoId: string; nombreModelo: string }>>({});
  const [loadingDuplicados, setLoadingDuplicados] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 });
  const [results, setResults] = useState<ResultadoItem[]>([]);
  const [itemsEnCarga, setItemsEnCarga] = useState<ItemParaCargar[]>([]);

  const validFiles = fileList.filter((f) => f.status === "pendiente");
  const validCount = validFiles.length;
  const selectedCount = selectedNames.size;
  const duplicadosMap = new Map(
    duplicadosResult?.duplicados?.map((d) => [d.nombreArchivo, d]) ?? []
  );
  const nuevosSet = new Set(duplicadosResult?.nuevos ?? []);

  const reset = useCallback(() => {
    setStep(1);
    setFileList([]);
    setDuplicadosResult(null);
    setSelectedNames(new Set());
    setAssignmentMode("same");
    setTipoIdSame("");
    setPerFileAssign({});
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
        `/api/secretaria/modelos-nota/validar-duplicados?nombres=${nombres}`
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
    const defaultTipoId = tiposActivos.length ? String(tiposActivos[0].id) : "";
    const items = validFiles
      .filter((f) => selectedNames.has(f.name))
      .map((f) => {
        const dup = duplicadosMap.get(f.name);
        const nombreModelo = nombreSinExtension(f.name);
        return {
          name: f.name,
          file: f.file,
          isDuplicate: !!dup,
          existingId: dup?.id,
          tipoId: defaultTipoId,
          nombreModelo,
        };
      });
    const initial: Record<string, { tipoId: string; nombreModelo: string }> = {};
    items.forEach((it) => {
      initial[it.name] = { tipoId: defaultTipoId, nombreModelo: it.nombreModelo };
    });
    setPerFileAssign(initial);
    setTipoIdSame(defaultTipoId);
    setStep(3);
  }, [validFiles, selectedNames, duplicadosMap, tiposActivos]);

  const toggleSelect = useCallback((name: string) => {
    setSelectedNames((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }, []);

  const selectAllNew = useCallback(() => {
    setSelectedNames(new Set(duplicadosResult?.nuevos ?? []));
  }, [duplicadosResult?.nuevos]);

  const itemsParaCargar = validFiles
    .filter((f) => selectedNames.has(f.name))
    .map((f) => {
      const dup = duplicadosMap.get(f.name);
      const assign = perFileAssign[f.name];
      const tipoId = assignmentMode === "same" ? tipoIdSame : assign?.tipoId ?? "";
      const nombreModelo = (assign?.nombreModelo?.trim()) || nombreSinExtension(f.name);
      return {
        name: f.name,
        file: f.file,
        isDuplicate: !!dup,
        existingId: dup?.id,
        tipoId,
        nombreModelo: nombreModelo || nombreSinExtension(f.name),
      };
    });

  const canGoPaso3 = selectedCount >= 1;
  const allHaveTipo =
    assignmentMode === "same"
      ? !!tipoIdSame
      : itemsParaCargar.every((it) => {
          const a = perFileAssign[it.name];
          return a?.tipoId;
        });
  const canCargar = itemsParaCargar.length >= 1 && allHaveTipo;

  const ejecutarCarga = useCallback(async () => {
    if (!canCargar) return;
    const items = [...itemsParaCargar];
    setItemsEnCarga(items);
    setUploading(true);
    setUploadProgress({ current: 0, total: items.length });
    setResults([]);

    const resList: ResultadoItem[] = [];

    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      setUploadProgress({ current: i + 1, total: items.length });

      try {
        if (it.existingId != null) {
          const form = new FormData();
          form.set("nombre", it.nombreModelo);
          form.set("tipoNotaId", it.tipoId);
          form.set("file", it.file);
          const res = await fetch(`/api/secretaria/modelos-nota/${it.existingId}`, {
            method: "PUT",
            body: form,
          });
          const data = await res.json();
          if (res.ok) {
            resList.push({ name: it.name, status: "ok" });
          } else {
            resList.push({ name: it.name, status: "error", message: data.error || "Error al actualizar" });
          }
        } else {
          const form = new FormData();
          form.set("tipoNotaId", it.tipoId);
          form.set("nombre", it.nombreModelo);
          form.set("file", it.file);
          const res = await fetch("/api/secretaria/modelos-nota", {
            method: "POST",
            body: form,
          });
          const data = await res.json();
          if (res.ok) {
            resList.push({ name: it.name, status: "ok" });
          } else {
            resList.push({ name: it.name, status: "error", message: data.error || "Error al subir" });
          }
        }
      } catch {
        resList.push({ name: it.name, status: "error", message: "Error de conexión" });
      }
      setResults([...resList]);
    }

    setUploading(false);
    setStep(4);
  }, [itemsParaCargar, canCargar]);

  const handleCerrar = useCallback(() => {
    handleOpenChange(false);
    onSuccess();
  }, [handleOpenChange, onSuccess]);

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Carga masiva de modelos</DialogTitle>
          <DialogDescription>
            Paso {step} de 4:{" "}
            {step === 1 && "Selección de archivos"}
            {step === 2 && "Validación de duplicados"}
            {step === 3 && "Asignación de tipo de nota"}
            {step === 4 && "Resultado"}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto space-y-4 py-2">
          {/* PASO 1 */}
          {step === 1 && (
            <>
              <div
                className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center bg-gray-50 hover:bg-gray-100 transition-colors cursor-pointer"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  addFiles(e.dataTransfer.files);
                }}
                onClick={() => document.getElementById("carga-masiva-input")?.click()}
              >
                <input
                  id="carga-masiva-input"
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
            </>
          )}

          {/* PASO 2 */}
          {step === 2 && (
            <>
              {loadingDuplicados ? (
                <div className="flex items-center gap-2 text-gray-500 py-8">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Verificando duplicados...
                </div>
              ) : (
                <>
                  <p className="text-sm text-gray-600">
                    {duplicadosResult?.nuevos?.length ?? 0} archivos nuevos |{" "}
                    {duplicadosResult?.duplicados?.length ?? 0} duplicados
                    encontrados | {selectedCount} seleccionados para cargar
                  </p>
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-10">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-xs"
                              onClick={selectAllNew}
                            >
                              Seleccionar todos los nuevos
                            </Button>
                          </TableHead>
                          <TableHead>Archivo</TableHead>
                          <TableHead>Tamaño</TableHead>
                          <TableHead>Estado detección</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {validFiles.map((f) => {
                          const esNuevo = nuevosSet.has(f.name);
                          const esDuplicado = !esNuevo;
                          const selected = selectedNames.has(f.name);
                          return (
                            <TableRow key={f.name}>
                              <TableCell>
                                <Checkbox
                                  checked={selected}
                                  onCheckedChange={() => toggleSelect(f.name)}
                                  aria-label={f.name}
                                />
                              </TableCell>
                              <TableCell>{f.name}</TableCell>
                              <TableCell>{formatSize(f.size)}</TableCell>
                              <TableCell>
                                {esNuevo ? (
                                  <span className="text-green-600 font-medium">Nuevo</span>
                                ) : (
                                  <span className="text-orange-600">
                                    Duplicado — Ya existe un modelo con este nombre
                                  </span>
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                  {selectedNames.size > 0 && duplicadosResult?.duplicados?.length ? (
                    <p className="flex items-center gap-2 text-amber-700 text-sm mt-2">
                      <AlertTriangle className="h-4 w-4" />
                      Si seleccionaste duplicados, al cargar se reemplazará el archivo existente.
                    </p>
                  ) : null}
                </>
              )}
            </>
          )}

          {/* PASO 3 */}
          {step === 3 && (
            <>
              <div className="flex gap-4 border-b pb-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="modo"
                    checked={assignmentMode === "same"}
                    onChange={() => setAssignmentMode("same")}
                  />
                  Asignar el mismo tipo a todos
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="modo"
                    checked={assignmentMode === "individual"}
                    onChange={() => setAssignmentMode("individual")}
                  />
                  Asignar tipo individualmente
                </label>
              </div>

              {assignmentMode === "same" && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tipo de nota (para todos)
                  </label>
                  <select
                    value={tipoIdSame}
                    onChange={(e) => setTipoIdSame(e.target.value)}
                    className="h-9 rounded-md border border-gray-300 bg-white px-3 text-sm w-full max-w-xs"
                  >
                    <option value="">Seleccionar...</option>
                    {tiposActivos.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.nombre}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Archivo</TableHead>
                      <TableHead>Nombre del modelo</TableHead>
                      {assignmentMode === "individual" && (
                        <TableHead>Tipo de nota</TableHead>
                      )}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {itemsParaCargar.map((it) => (
                      <TableRow key={it.name}>
                        <TableCell>{it.name}</TableCell>
                        <TableCell>
                          <input
                            type="text"
                            value={perFileAssign[it.name]?.nombreModelo ?? it.nombreModelo}
                            onChange={(e) =>
                              setPerFileAssign((prev) => ({
                                ...prev,
                                [it.name]: {
                                  ...prev[it.name],
                                  tipoId: prev[it.name]?.tipoId ?? "",
                                  nombreModelo: e.target.value,
                                },
                              }))
                            }
                            className="h-8 w-full max-w-xs rounded border border-gray-300 px-2 text-sm"
                          />
                        </TableCell>
                        {assignmentMode === "individual" && (
                          <TableCell>
                            <select
                              value={perFileAssign[it.name]?.tipoId ?? ""}
                              onChange={(e) =>
                                setPerFileAssign((prev) => ({
                                  ...prev,
                                  [it.name]: {
                                    ...prev[it.name],
                                    tipoId: e.target.value,
                                    nombreModelo: prev[it.name]?.nombreModelo ?? nombreSinExtension(it.name),
                                  },
                                }))
                              }
                              className="h-8 rounded border border-gray-300 bg-white px-2 text-sm"
                            >
                              <option value="">Seleccionar...</option>
                              {tiposActivos.map((t) => (
                                <option key={t.id} value={t.id}>
                                  {t.nombre}
                                </option>
                              ))}
                            </select>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <p className="text-sm text-gray-600">
                Se van a cargar {itemsParaCargar.length} archivos.
                {assignmentMode === "same" && tipoIdSame && (
                  <span className="ml-1">
                    Tipo: {tiposActivos.find((t) => String(t.id) === tipoIdSame)?.nombre ?? ""}
                  </span>
                )}
              </p>
            </>
          )}

          {/* PASO 4 - Cargando o Resultado */}
          {step === 4 && (
            <>
              {uploading && (
                <p className="text-sm text-gray-600 flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Cargando {uploadProgress.current} de {uploadProgress.total}...
                </p>
              )}
              {(results.length > 0 || (uploading && itemsEnCarga.length > 0)) && (
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Archivo</TableHead>
                        <TableHead>Estado</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(uploading ? itemsEnCarga : results).map((item, idx) => {
                        const name = uploading ? (item as ItemParaCargar).name : (item as ResultadoItem).name;
                        const r = uploading ? results[idx] : (item as ResultadoItem);
                        const isLoading = uploading && idx === uploadProgress.current - 1 && !r;
                        const isPending = uploading && idx >= uploadProgress.current;
                        return (
                          <TableRow key={name}>
                            <TableCell>{name}</TableCell>
                            <TableCell>
                              {isLoading && (
                                <span className="text-gray-500 flex items-center gap-1">
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                  Cargando...
                                </span>
                              )}
                              {isPending && (
                                <span className="text-gray-400">Pendiente</span>
                              )}
                              {r?.status === "ok" && (
                                <span className="text-green-600 flex items-center gap-1">
                                  <CheckCircle2 className="h-4 w-4" />
                                  Cargado correctamente
                                </span>
                              )}
                              {r?.status === "error" && (
                                <span className="text-red-600 flex items-center gap-1">
                                  <XCircle className="h-4 w-4" />
                                  Error al cargar{r.message ? `: ${r.message}` : ""}
                                </span>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
              {!uploading && results.length > 0 && (
                <p className="text-sm">
                  {results.filter((r) => r.status === "ok").length} archivos cargados
                  correctamente.
                  {results.some((r) => r.status === "error") && (
                    <span className="text-red-600 block mt-1">
                      {results.filter((r) => r.status === "error").length} archivos con error.
                    </span>
                  )}
                </p>
              )}
            </>
          )}
        </div>

        <DialogFooter className="border-t pt-4">
          {step === 1 && (
            <>
              <Button variant="outline" onClick={() => handleOpenChange(false)}>
                Cancelar
              </Button>
              <Button
                className="bg-[#4CAF50] hover:bg-[#388E3C]"
                onClick={goPaso2}
                disabled={validCount < 1}
              >
                Siguiente
              </Button>
            </>
          )}
          {step === 2 && !loadingDuplicados && (
            <>
              <Button variant="outline" onClick={() => setStep(1)}>
                Anterior
              </Button>
              <Button
                className="bg-[#4CAF50] hover:bg-[#388E3C]"
                onClick={goPaso3}
                disabled={!canGoPaso3}
              >
                Siguiente
              </Button>
            </>
          )}
          {step === 3 && !uploading && (
            <>
              <Button variant="outline" onClick={() => setStep(2)}>
                Anterior
              </Button>
              <Button
                className="bg-[#4CAF50] hover:bg-[#388E3C]"
                onClick={ejecutarCarga}
                disabled={!canCargar}
              >
                Cargar archivos
              </Button>
            </>
          )}
          {step === 4 && !uploading && (
            <Button className="bg-[#4CAF50] hover:bg-[#388E3C]" onClick={handleCerrar}>
              Cerrar
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
