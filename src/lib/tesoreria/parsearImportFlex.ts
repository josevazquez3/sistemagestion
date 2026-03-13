export type FormatoImport = "A" | "B" | "C" | "DESCONOCIDO";

export interface MovimientoImportado {
  fecha: Date;
  concepto: string;
  importePesos: number;
  tipo: "INGRESO" | "GASTO";
}

export function detectarFormato(headers: string[]): FormatoImport {
  const hs = headers.map((h) => String(h ?? "").toLowerCase().trim());
  if (hs.some((h) => h.includes("tramite") || h.includes("nombre y apellido")))
    return "C";
  if (
    hs.includes("importe") &&
    !hs.includes("entrada") &&
    !hs.includes("salida")
  )
    return "A";
  if (hs.includes("entrada") || hs.includes("salida")) return "B";
  return "DESCONOCIDO";
}

export function parsearFechaFlex(valor: unknown): Date | null {
  if (valor == null || valor === "") return null;

  if (valor instanceof Date) {
    return new Date(
      Date.UTC(
        valor.getUTCFullYear(),
        valor.getUTCMonth(),
        valor.getUTCDate(),
        12,
        0,
        0
      )
    );
  }

  if (typeof valor === "string") {
    const m = valor.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (m) {
      return new Date(
        Date.UTC(
          parseInt(m[3], 10),
          parseInt(m[2], 10) - 1,
          parseInt(m[1], 10),
          12,
          0,
          0
        )
      );
    }
  }

  if (typeof valor === "number" && valor > 40000 && valor < 60000) {
    const epoch = new Date(Date.UTC(1899, 11, 30));
    const d = new Date(epoch.getTime() + valor * 86400000);
    return new Date(
      Date.UTC(
        d.getUTCFullYear(),
        d.getUTCMonth(),
        d.getUTCDate(),
        12,
        0,
        0
      )
    );
  }

  return null;
}

export function parsearImporteFlex(valor: unknown): number {
  if (valor == null || valor === "") return 0;
  if (typeof valor === "number") return valor;

  const str = String(valor).trim();
  const esNegativo = str.startsWith("-") || str.startsWith("(");
  const limpio = str
    .replace(/[()$\s-]/g, "")
    .replace(/\./g, "")
    .replace(",", ".");
  const num = parseFloat(limpio);
  if (Number.isNaN(num)) return 0;
  return esNegativo ? -Math.abs(num) : Math.abs(num);
}

export function parsearExcelGenerico(filas: unknown[][]): MovimientoImportado[] {
  const resultado: MovimientoImportado[] = [];

  let headerIdx = -1;
  for (let i = 0; i < Math.min(filas.length, 10); i++) {
    const fila = filas[i] as unknown[] | undefined;
    if (!fila) continue;
    const vals = fila.map((c) => String(c ?? "").toLowerCase().trim());
    if (
      vals.some((v) => v === "fecha") ||
      vals.some((v) => v === "concepto") ||
      vals.some((v) => v.includes("tramite")) ||
      vals.some((v) => v.includes("nombre"))
    ) {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx === -1) return [];

  const headers = (filas[headerIdx] as unknown[]).map((h) =>
    String(h ?? "").toLowerCase().trim()
  );
  const formato = detectarFormato(headers);
  if (formato === "DESCONOCIDO") return [];

  const idx = {
    fecha: headers.findIndex((h) => h === "fecha"),
    concepto: headers.findIndex((h) => h === "concepto"),
    importe: headers.findIndex((h) => h === "importe"),
    entrada: headers.findIndex((h) => h === "entrada"),
    salida: headers.findIndex((h) => h === "salida"),
    tramite: headers.findIndex((h) => h.includes("tramite")),
    nombre: headers.findIndex((h) => h.includes("nombre")),
    dto: headers.findIndex((h) => h.includes("dto") || h === "dto."),
  };

  for (let i = headerIdx + 1; i < filas.length; i++) {
    const fila = filas[i] as unknown[] | undefined;
    if (!fila || fila.every((c) => c == null || c === "")) continue;

    if (formato === "C") {
      const tramite = String(
        idx.tramite >= 0 ? fila[idx.tramite] ?? "" : ""
      ).trim();
      const nombre = String(
        idx.nombre >= 0 ? fila[idx.nombre] ?? "" : ""
      ).trim();
      const dto = String(idx.dto >= 0 ? fila[idx.dto] ?? "" : "").trim();

      if (!tramite && !nombre) continue;

      const concepto = [tramite, nombre ? `- ${nombre}` : "", dto ? `(Dto. ${dto})` : ""]
        .filter(Boolean)
        .join(" ")
        .trim();

      const fecha = parsearFechaFlex(idx.fecha >= 0 ? fila[idx.fecha] : undefined);
      if (!fecha) continue;

      const importe = parsearImporteFlex(
        idx.importe >= 0 ? fila[idx.importe] : undefined
      );
      if (importe === 0) continue;

      resultado.push({
        fecha,
        concepto,
        importePesos: Math.abs(importe),
        tipo: "INGRESO",
      });
      continue;
    }

    if (formato === "A") {
      const concepto = String(
        idx.concepto >= 0 ? fila[idx.concepto] ?? "" : ""
      ).trim();
      if (!concepto) continue;
      if (concepto.toLowerCase().includes("saldo anterior")) continue;

      const fecha = parsearFechaFlex(idx.fecha >= 0 ? fila[idx.fecha] : undefined);
      if (!fecha) continue;

      const importe = parsearImporteFlex(
        idx.importe >= 0 ? fila[idx.importe] : undefined
      );
      if (importe === 0) continue;

      resultado.push({
        fecha,
        concepto,
        importePesos: importe,
        tipo: importe >= 0 ? "INGRESO" : "GASTO",
      });
      continue;
    }

    if (formato === "B") {
      const concepto = String(
        idx.concepto >= 0 ? fila[idx.concepto] ?? "" : ""
      ).trim();
      if (!concepto) continue;
      if (concepto.toLowerCase().includes("saldo anterior")) continue;

      const fecha = parsearFechaFlex(idx.fecha >= 0 ? fila[idx.fecha] : undefined);
      if (!fecha) continue;

      const entrada = parsearImporteFlex(
        idx.entrada >= 0 ? fila[idx.entrada] : undefined
      );
      const salida = parsearImporteFlex(
        idx.salida >= 0 ? fila[idx.salida] : undefined
      );
      let importe = 0;
      if (entrada !== 0) importe = Math.abs(entrada);
      else if (salida !== 0) importe = -Math.abs(salida);
      if (importe === 0) continue;

      resultado.push({
        fecha,
        concepto,
        importePesos: importe,
        tipo: importe >= 0 ? "INGRESO" : "GASTO",
      });
    }
  }

  return resultado;
}
