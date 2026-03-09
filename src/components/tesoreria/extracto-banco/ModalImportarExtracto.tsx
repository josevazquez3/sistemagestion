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
import { parsearArchivoExtracto, formatearImporteAR, type MovimientoRaw } from "@/lib/parsearExtracto";
import { SelectorCuenta } from "./SelectorCuenta";

type MovimientoConDuplicado = MovimientoRaw & { duplicado?: boolean; cuentaId?: number | null; codigoCuenta?: string; nombreCuenta?: string };

type ModalImportarExtractoProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  showMessage: (tipo: "ok" | "error", text: string) => void;
};

function formatFecha(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

export function ModalImportarExtracto({
  open,
  onOpenChange,
  onSuccess,
  showMessage,
}: ModalImportarExtractoProps) {
  const [paso, setPaso] = useState<1 | 2 | 3 | 4>(1);
  const [movimientos, setMovimientos] = useState<MovimientoConDuplicado[]>([]);
  const [seleccionados, setSeleccionados] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);
  const [errorArchivo, setErrorArchivo] = useState<string | null>(null);

  const reset = useCallback(() => {
    setPaso(1);
    setMovimientos([]);
    setSeleccionados(new Set());
    setErrorArchivo(null);
  }, []);

  const handleCerrar = useCallback(
    (open: boolean) => {
      if (!open) reset();
      onOpenChange(open);
    },
    [onOpenChange, reset]
  );

  const handleFile = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0];
      if (!f) return;
      setErrorArchivo(null);
      const nombre = f.name.toLowerCase();
      if (!nombre.endsWith(".csv") && !nombre.endsWith(".xls")) {
        showMessage("error", "Solo se permiten archivos .csv o .xls (texto delimitado).");
        return;
      }
      setLoading(true);
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const text = (reader.result as string) || "";
          const parsed = parsearArchivoExtracto(text);
          if (parsed.length === 0) {
            setErrorArchivo("No se encontraron movimientos en el archivo.");
            setLoading(false);
            return;
          }
          setMovimientos(parsed.map((m) => ({ ...m, cuentaId: null, codigoCuenta: "", nombreCuenta: "" })));
          setPaso(2);
        } catch (err) {
          setErrorArchivo(err instanceof Error ? err.message : "Error al parsear.");
        } finally {
          setLoading(false);
        }
      };
      reader.onerror = () => {
        setErrorArchivo("Error al leer el archivo.");
        setLoading(false);
      };
      reader.readAsText(f, "ISO-8859-1");
    },
    [showMessage]
  );

  useEffect(() => {
    if (paso !== 2 || movimientos.length === 0) return;
    if (movimientos.some((m) => m.duplicado !== undefined)) return;
    setLoading(true);
    fetch("/api/tesoreria/extracto-banco/validar-duplicados", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        movimientos.map((m) => ({
          fecha: m.fecha,
          referencia: m.referencia,
          importePesos: m.importePesos,
        }))
      ),
    })
      .then((res) => res.json())
      .then((resultados: { duplicado: boolean }[]) => {
        setMovimientos((prev) =>
          prev.map((m, i) => ({ ...m, duplicado: resultados[i]?.duplicado ?? false }))
        );
        const indicesNoDup = resultados
          .map((r, i) => (r.duplicado ? -1 : i))
          .filter((i) => i >= 0) as number[];
        setSeleccionados(new Set(indicesNoDup));
      })
      .catch(() => showMessage("error", "Error al validar duplicados."))
      .finally(() => setLoading(false));
  }, [paso, movimientos.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleTodos = useCallback(() => {
    const noDup = movimientos.map((m, i) => (m.duplicado ? -1 : i)).filter((i) => i >= 0) as number[];
    if (seleccionados.size >= noDup.length) setSeleccionados(new Set());
    else setSeleccionados(new Set(noDup));
  }, [movimientos, seleccionados.size]);

  const toggleFila = useCallback((i: number) => {
    if (movimientos[i]?.duplicado) return;
    setSeleccionados((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }, [movimientos]);

  const eliminarFila = useCallback((i: number) => {
    setMovimientos((prev) => prev.filter((_, idx) => idx !== i));
    setSeleccionados((prev) => {
      const next = new Set(prev);
      next.delete(i);
      return new Set([...next].map((j) => (j > i ? j - 1 : j)));
    });
  }, []);

  const actualizarCuenta = useCallback((index: number, cuentaId: number | null, codigo: string, nombre: string) => {
    setMovimientos((prev) =>
      prev.map((m, i) =>
        i === index ? { ...m, cuentaId, codigoCuenta: codigo, nombreCuenta: nombre } : m
      )
    );
  }, []);

  const handleImportar = useCallback(async () => {
    const aImportar = Array.from(seleccionados)
      .filter((i) => i >= 0 && i < movimientos.length && !movimientos[i].duplicado)
      .map((i) => {
        const m = movimientos[i];
        return {
          fecha: m.fecha,
          sucOrigen: m.sucOrigen,
          descSucursal: m.descSucursal,
          codOperativo: m.codOperativo,
          referencia: m.referencia,
          concepto: m.concepto,
          importePesos: m.importePesos,
          saldoPesos: m.saldoPesos,
          cuentaId: m.cuentaId ?? null,
        };
      });
    if (aImportar.length === 0) {
      showMessage("error", "No hay movimientos seleccionados para importar.");
      return;
    }
    setLoading(true);
    const res = await fetch("/api/tesoreria/extracto-banco", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(aImportar),
    });
    const data = await res.json();
    setLoading(false);
    if (res.ok) {
      setPaso(4);
      showMessage("ok", data.mensaje ?? `${data.count} movimientos importados correctamente.`);
    } else {
      showMessage("error", data.error || "Error al importar.");
    }
  }, [seleccionados, movimientos, showMessage]);

  const handleCerrarYRefrescar = useCallback(() => {
    handleCerrar(false);
    onSuccess();
  }, [handleCerrar, onSuccess]);

  return (
    <Dialog open={open} onOpenChange={handleCerrar}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Importar extracto bancario</DialogTitle>
          <DialogDescription>
            {paso === 1 && "Seleccioná un archivo .csv o .xls (delimitado por ; o tab). Encoding: Latin-1."}
            {paso === 2 && "Vista previa. Los duplicados se marcan en amarillo. Asigná cuenta si corresponde."}
            {paso === 3 && "Confirmá la importación."}
            {paso === 4 && "Importación finalizada."}
          </DialogDescription>
        </DialogHeader>

        {paso === 1 && (
          <div className="space-y-4">
            <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100">
              <input
                type="file"
                accept=".csv,.xls"
                className="hidden"
                onChange={handleFile}
                disabled={loading}
              />
              <FolderUp className="w-10 h-10 text-gray-400 mb-2" />
              <span className="text-sm text-gray-600">CSV o .xls (encoding ISO-8859-1)</span>
              {loading && <Loader2 className="w-5 h-5 animate-spin mt-2 text-gray-400" />}
            </label>
            {errorArchivo && <p className="text-sm text-red-600">{errorArchivo}</p>}
          </div>
        )}

        {paso === 2 && (
          <div className="space-y-2">
            <p className="text-sm text-gray-600">
              Seleccionados: {seleccionados.size} / {movimientos.filter((m) => !m.duplicado).length}
            </p>
            <div className="border rounded-lg overflow-auto max-h-[50vh]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox
                        checked={
                          movimientos.filter((m) => !m.duplicado).length > 0 &&
                          seleccionados.size >= movimientos.filter((m) => !m.duplicado).length
                        }
                        onCheckedChange={toggleTodos}
                      />
                    </TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Ref.</TableHead>
                    <TableHead>Concepto</TableHead>
                    <TableHead className="text-right">Importe</TableHead>
                    <TableHead>Cuenta</TableHead>
                    <TableHead className="w-16"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {movimientos.map((m, i) => (
                    <TableRow key={i} className={m.duplicado ? "bg-yellow-50" : ""}>
                      <TableCell>
                        {!m.duplicado && (
                          <Checkbox
                            checked={seleccionados.has(i)}
                            onCheckedChange={() => toggleFila(i)}
                          />
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">{formatFecha(m.fecha)}</TableCell>
                      <TableCell>{m.referencia ?? "—"}</TableCell>
                      <TableCell className="max-w-[200px] truncate">{m.concepto}</TableCell>
                      <TableCell
                        className={`text-right font-medium ${
                          m.importePesos >= 0 ? "text-green-700" : "text-red-700"
                        }`}
                      >
                        $ {formatearImporteAR(m.importePesos)}
                      </TableCell>
                      <TableCell>
                        {!m.duplicado && (
                          <SelectorCuenta
                            cuentaId={m.cuentaId ?? null}
                            codigoInicial={m.codigoCuenta}
                            nombreInicial={m.nombreCuenta}
                            onSelect={(cuentaId, codigo, nombre) =>
                              actualizarCuenta(i, cuentaId, codigo, nombre)
                            }
                            placeholderCodigo="Código"
                            placeholderNombre="Nombre"
                          />
                        )}
                      </TableCell>
                      <TableCell>
                        {m.duplicado ? (
                          <span className="text-xs px-2 py-0.5 rounded bg-yellow-200 text-yellow-800">
                            Duplicado
                          </span>
                        ) : (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0 text-red-600"
                            onClick={() => eliminarFila(i)}
                            title="Quitar del listado"
                          >
                            🗑️
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {loading && <Loader2 className="h-5 w-5 animate-spin text-gray-400" />}
          </div>
        )}

        {paso === 4 && (
          <p className="text-green-700 font-medium">
            Movimientos importados correctamente.
          </p>
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
              <Button onClick={handleImportar} disabled={loading || seleccionados.size === 0}>
                {loading ? "Importando…" : "Importar seleccionados"}
              </Button>
            </>
          )}
          {paso === 4 && (
            <Button onClick={handleCerrarYRefrescar}>
              Cerrar
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
