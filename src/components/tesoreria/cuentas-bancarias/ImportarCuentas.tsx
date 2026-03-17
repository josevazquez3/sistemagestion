"use client";

import { useState, useCallback, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { FolderUp, Loader2 } from "lucide-react";
import * as XLSX from "xlsx";

type FilaCuenta = { codigo: string; codOperativo?: string | null; nombre: string; duplicado?: boolean };

type ImportarCuentasProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  showMessage: (tipo: "ok" | "error", text: string) => void;
};

function detectarIndices(headers: string[]): { codigo: number; codOperativo: number | null; nombre: number } {
  const lower = headers.map((h) => String(h).toLowerCase().trim());
  const idxCodigo = lower.findIndex((h) => h.includes("código") || h === "codigo");
  const idxCodOp = lower.findIndex((h) => h === "cod. operativo" || h === "cod operativo" || h.includes("cod. operativo"));
  const idxNombre = lower.findIndex((h) => h.includes("nombre"));
  return {
    codigo: idxCodigo >= 0 ? idxCodigo : 0,
    codOperativo: idxCodOp >= 0 ? idxCodOp : null,
    nombre: idxNombre >= 0 ? idxNombre : 1,
  };
}

function parsearArchivo(file: File): Promise<FilaCuenta[]> {
  const nombre = file.name.toLowerCase();
  if (nombre.endsWith(".csv")) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const text = (reader.result as string) || "";
        const lineas = text.split(/\r?\n/).filter((l) => l.trim());
        const delimitador = text.includes(";") ? ";" : ",";
        const filas: FilaCuenta[] = [];
        let idx = { codigo: 0, codOperativo: null as number | null, nombre: 1 };
        for (let i = 0; i < lineas.length; i++) {
          const cols = lineas[i].split(delimitador).map((c) => c.trim());
          if (i === 0 && cols.some((c) => String(c).toLowerCase().includes("codigo") || String(c).toLowerCase().includes("código"))) {
            idx = detectarIndices(cols);
            continue;
          }
          if (cols.length >= 2) {
            const codigo = cols[idx.codigo] ?? "";
            const nombre = cols[idx.nombre] ?? "";
            const codOperativo = idx.codOperativo !== null ? (cols[idx.codOperativo] ?? "").trim() || null : null;
            filas.push({ codigo, codOperativo, nombre });
          }
        }
        resolve(filas);
      };
      reader.onerror = () => reject(new Error("Error al leer el archivo"));
      reader.readAsText(file, "UTF-8");
    });
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = new Uint8Array(reader.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: "array" });
        const first = wb.SheetNames[0];
        if (!first) return resolve([]);
        const sheet = wb.Sheets[first];
        const rows = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1 });
        const filas: FilaCuenta[] = [];
        let start = 0;
        let idx = { codigo: 0, codOperativo: null as number | null, nombre: 1 };
        if (rows[0]?.length) {
          idx = detectarIndices(rows[0] as string[]);
          if (rows[0]?.some((c) => String(c).toLowerCase().includes("codigo") || String(c).toLowerCase().includes("código"))) start = 1;
        }
        for (let i = start; i < rows.length; i++) {
          const row = rows[i];
          if (!row || row.length < 2) continue;
          const codigo = String(row[idx.codigo] ?? "").trim();
          const nombre = String(row[idx.nombre] ?? "").trim();
          const codOperativo = idx.codOperativo !== null ? (String(row[idx.codOperativo] ?? "").trim() || null) : null;
          if (codigo || nombre) filas.push({ codigo, codOperativo, nombre });
        }
        resolve(filas);
      } catch (e) {
        reject(e);
      }
    };
    reader.onerror = () => reject(new Error("Error al leer el archivo"));
    reader.readAsArrayBuffer(file);
  });
}

export function ImportarCuentas({
  open,
  onOpenChange,
  onSuccess,
  showMessage,
}: ImportarCuentasProps) {
  const [paso, setPaso] = useState<1 | 2 | 3>(1);
  const [filas, setFilas] = useState<FilaCuenta[]>([]);
  const [seleccionados, setSeleccionados] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);
  const [file, setFile] = useState<File | null>(null);

  const reset = useCallback(() => {
    setPaso(1);
    setFilas([]);
    setSeleccionados(new Set());
    setFile(null);
  }, []);

  const handleCerrar = useCallback(
    (open: boolean) => {
      if (!open) reset();
      onOpenChange(open);
    },
    [onOpenChange, reset]
  );

  const handleFile = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0];
      if (!f) return;
      const nombre = f.name.toLowerCase();
      if (!nombre.endsWith(".csv") && !nombre.endsWith(".xlsx") && !nombre.endsWith(".xls")) {
        showMessage("error", "Solo se permiten archivos CSV o Excel (.xlsx, .xls).");
        return;
      }
      setLoading(true);
      try {
        const parsed = await parsearArchivo(f);
        if (parsed.length === 0) {
          showMessage("error", "No se encontraron filas con columnas Código y Nombre.");
          return;
        }
        setFile(f);
        setFilas(parsed);
        setPaso(2);
      } catch (err) {
        showMessage("error", err instanceof Error ? err.message : "Error al parsear el archivo.");
      } finally {
        setLoading(false);
      }
    },
    [showMessage]
  );

  const cargarDuplicados = useCallback(async (filasActuales: FilaCuenta[]) => {
    const res = await fetch("/api/tesoreria/cuentas-bancarias/todas");
    const data = await res.json();
    if (!res.ok) return;
    const existentes = (data as { codigo: string; codOperativo?: string | null }[]) ?? [];
    const esDuplicado = (f: FilaCuenta) => {
      const ex = existentes.find((c) => c.codigo === f.codigo.trim());
      if (!ex) return false;
      const nuevos = (f.codOperativo ?? "").trim().split(/\s+/).filter(Boolean);
      if (nuevos.length === 0) return true;
      const ya = new Set((ex.codOperativo ?? "").trim().split(/\s+/).filter(Boolean));
      return nuevos.every((op) => ya.has(op));
    };
    setFilas((prev) => prev.map((f) => ({ ...f, duplicado: esDuplicado(f) })));
    const indicesNoDup = filasActuales
      .map((f, i) => (esDuplicado(f) ? -1 : i))
      .filter((i) => i >= 0) as number[];
    setSeleccionados(new Set(indicesNoDup));
  }, []);

  const toggleTodos = useCallback(() => {
    const noDup = filas.map((f, i) => (f.duplicado ? -1 : i)).filter((i) => i >= 0) as number[];
    if (seleccionados.size >= noDup.length) {
      setSeleccionados(new Set());
    } else {
      setSeleccionados(new Set(noDup));
    }
  }, [filas, seleccionados.size]);

  const toggleFila = useCallback((i: number) => {
    if (filas[i]?.duplicado) return;
    setSeleccionados((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }, [filas]);

  const handleConfirmar = useCallback(async () => {
    const aImportar = Array.from(seleccionados)
      .filter((i) => !filas[i]?.duplicado && filas[i]?.codigo?.trim())
      .map((i) => ({
        codigo: filas[i].codigo.trim(),
        codOperativo: (filas[i].codOperativo ?? "").trim() || null,
        nombre: filas[i].nombre.trim(),
      }));
    if (aImportar.length === 0) {
      showMessage("error", "No hay filas seleccionadas para importar.");
      return;
    }
    setLoading(true);
    let ok = 0;
    let errores = 0;
    for (const c of aImportar) {
      const res = await fetch("/api/tesoreria/cuentas-bancarias", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          codigo: c.codigo,
          codOperativo: c.codOperativo,
          nombre: c.nombre,
        }),
      });
      if (res.ok) ok++;
      else errores++;
    }
    setLoading(false);
    if (errores === 0) {
      showMessage("ok", `${ok} cuentas importadas correctamente.`);
      handleCerrar(false);
      onSuccess();
    } else {
      showMessage("error", `Se importaron ${ok} y ${errores} fallaron (código duplicado u otro error).`);
      onSuccess();
      handleCerrar(false);
    }
  }, [seleccionados, filas, showMessage, onSuccess, handleCerrar]);

  useEffect(() => {
    if (paso === 2 && filas.length > 0 && filas.every((f) => f.duplicado === undefined)) {
      cargarDuplicados(filas);
    }
  }, [paso, filas.length]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Dialog open={open} onOpenChange={handleCerrar}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Importar cuentas bancarias</DialogTitle>
          <DialogDescription>
            {paso === 1 && "Subí un archivo CSV o Excel con columnas: Código, Nombre."}
            {paso === 2 && "Revisá la vista previa. Los duplicados (código existente) se marcan en amarillo."}
            {paso === 3 && "Confirmá la importación."}
          </DialogDescription>
        </DialogHeader>

        {paso === 1 && (
          <div className="space-y-4">
            <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100">
              <input type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={handleFile} disabled={loading} />
              <FolderUp className="w-10 h-10 text-gray-400 mb-2" />
              <span className="text-sm text-gray-600">CSV o Excel (Código, Nombre)</span>
              {loading && <Loader2 className="w-5 h-5 animate-spin mt-2 text-gray-400" />}
            </label>
          </div>
        )}

        {paso === 2 && (
          <div className="space-y-2">
            <div className="border rounded-lg overflow-auto max-h-[400px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={filas.filter((f) => !f.duplicado).length > 0 && seleccionados.size >= filas.filter((f) => !f.duplicado).length}
                        onCheckedChange={toggleTodos}
                      />
                    </TableHead>
                    <TableHead>Código</TableHead>
                    <TableHead>Cód. operativo</TableHead>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filas.map((f, i) => (
                    <TableRow
                      key={i}
                      className={f.duplicado ? "bg-yellow-50" : ""}
                    >
                      <TableCell>
                        {!f.duplicado && (
                          <Checkbox
                            checked={seleccionados.has(i)}
                            onCheckedChange={() => toggleFila(i)}
                          />
                        )}
                      </TableCell>
                      <TableCell>{f.codigo}</TableCell>
                      <TableCell>{f.codOperativo ?? "—"}</TableCell>
                      <TableCell>{f.nombre}</TableCell>
                      <TableCell>
                        {f.duplicado ? (
                          <span className="text-xs font-medium px-2 py-0.5 rounded bg-yellow-200 text-yellow-800">
                            Duplicado
                          </span>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <p className="text-sm text-gray-600">
              Seleccionados: {seleccionados.size} / {filas.filter((f) => !f.duplicado).length}
            </p>
          </div>
        )}

        <DialogFooter>
          {paso === 1 && (
            <Button variant="outline" onClick={() => handleCerrar(false)}>
              Cancelar
            </Button>
          )}
          {paso === 2 && (
            <>
              <Button variant="outline" onClick={() => setPaso(1)}>
                Atrás
              </Button>
              <Button onClick={() => setPaso(3)} disabled={seleccionados.size === 0}>
                Importar seleccionados
              </Button>
            </>
          )}
          {paso === 3 && (
            <>
              <Button variant="outline" onClick={() => setPaso(2)}>
                Atrás
              </Button>
              <Button onClick={handleConfirmar} disabled={loading}>
                {loading ? "Importando…" : "Confirmar importación"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
