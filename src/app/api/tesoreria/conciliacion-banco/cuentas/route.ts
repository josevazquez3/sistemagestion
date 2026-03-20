import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  encontrarCuentaPorCodigoMovimientoExtracto,
  tokensCodOperativoCuenta,
  tokensCubiertosPorCuentaBancaria,
} from "@/lib/tesoreria/encontrarCuentaPorCodOperativo";

const ROLES = ["ADMIN", "TESORERO", "SUPER_ADMIN"] as const;

type CuentaFila = {
  cuentaCodigo: string;
  codigo: string;
  codOperativo: string;
  nombre: string;
};

function normalizarUnaLinea(s: string): string {
  return s
    .replace(/\//g, " ")
    .replace(/\|/g, " ")
    .replace(/[\r\n]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function nombreValido(nombre: string, codigo: string, codOp: string): boolean {
  const n = nombre.trim();
  if (!n || n.length < 2) return false;
  if (n === codigo || n === codOp) return false;
  const tokensOp = tokensCodOperativoCuenta(codOp);
  if (tokensOp.includes(n)) return false;
  return true;
}

function tokensCubiertosPorFila(f: CuentaFila): Set<string> {
  const s = new Set<string>();
  s.add(f.cuentaCodigo.trim());
  normalizarUnaLinea(f.codOperativo)
    .split(/\s+/)
    .filter(Boolean)
    .forEach((t) => s.add(t));
  return s;
}

export async function GET() {
  const session = await auth();
  const roles = (session?.user as { roles?: string[] })?.roles ?? [];
  if (!ROLES.some((r) => roles.includes(r))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const cuentasDb = await prisma.cuentaBancaria.findMany({
    where: { activo: true },
    orderBy: [{ codigo: "asc" }, { id: "asc" }],
  });

  const todosCodigos = await prisma.movimientoExtracto.findMany({
    where: { codOperativo: { not: null } },
    select: { codOperativo: true },
    distinct: ["codOperativo"],
    orderBy: { codOperativo: "asc" },
  });

  const codigosExtracto = new Set(
    todosCodigos.map((row) => String(row.codOperativo ?? "").trim()).filter(Boolean)
  );

  /** Cualquier código de extracto que matchea codigo o algún token de codOperativo de la cuenta */
  function cuentaApareceEnExtracto(r: (typeof cuentasDb)[0]): boolean {
    const cg = String(r.codigo ?? "").trim();
    if (codigosExtracto.has(cg)) return true;
    return tokensCodOperativoCuenta(r.codOperativo).some((t) => codigosExtracto.has(t));
  }

  /** Todos los códigos de movimiento ya cubiertos por alguna cuenta del catálogo */
  const cubiertosPorCatalogo = new Set<string>();
  for (const r of cuentasDb) {
    tokensCubiertosPorCuentaBancaria(r).forEach((t) => cubiertosPorCatalogo.add(t));
  }

  const resultado: CuentaFila[] = [];
  const porCodigoCuenta = new Map<string, CuentaFila>();

  for (const r of cuentasDb) {
    const codigoRaw = String(r.codigo ?? "").trim();
    const codOpRaw = normalizarUnaLinea(r.codOperativo ?? "");
    const nombreRaw = String(r.nombre ?? "").trim();
    const primerToken = codOpRaw.split(/\s+/).filter(Boolean)[0] ?? "";
    const codigoFinal = codigoRaw || primerToken || "S/C";
    const codOpDisplay = codOpRaw;

    const validNombre = nombreValido(nombreRaw, codigoFinal, codOpDisplay || codigoFinal);
    const necesariaParaExtracto = cuentaApareceEnExtracto(r);

    if (!validNombre && !necesariaParaExtracto) continue;
    if (porCodigoCuenta.has(codigoFinal)) continue;

    const nombreOut =
      validNombre && nombreRaw.trim().length >= 2
        ? nombreRaw
        : nombreRaw.trim().length >= 2
          ? nombreRaw
          : necesariaParaExtracto
            ? nombreRaw.trim() || `Cuenta ${codigoFinal}`
            : nombreRaw;

    const fila: CuentaFila = {
      cuentaCodigo: codigoFinal,
      codigo: codigoFinal,
      codOperativo: codOpDisplay,
      nombre: nombreOut.trim() || `Cuenta ${codigoFinal}`,
    };
    porCodigoCuenta.set(codigoFinal, fila);
    resultado.push(fila);
  }

  const cubiertos = new Set<string>(cubiertosPorCatalogo);
  for (const f of resultado) {
    tokensCubiertosPorFila(f).forEach((t) => cubiertos.add(t));
  }

  const movConCuenta = await prisma.movimientoExtracto.findMany({
    where: { codOperativo: { not: null }, cuentaId: { not: null } },
    select: {
      codOperativo: true,
      cuenta: { select: { codigo: true, codOperativo: true, nombre: true } },
    },
  });

  const nombrePorCodMov = new Map<string, { codigo: string; codOp: string; nombre: string }>();
  for (const m of movConCuenta) {
    const cod = String(m.codOperativo ?? "").trim();
    if (!cod || !m.cuenta) continue;
    const cu = m.cuenta;
    const nombre = String(cu.nombre).trim();
    const codigo = String(cu.codigo).trim();
    const codOpCuenta = normalizarUnaLinea(cu.codOperativo ?? "") || codigo;
    const matchTok = tokensCodOperativoCuenta(cu.codOperativo).includes(cod);
    if (!nombreValido(nombre, codigo, cod) && !matchTok) continue;
    const nombreUsar = nombre.trim() || (matchTok ? `Cuenta ${codigo}` : "");
    if (!nombreUsar) continue;
    const prev = nombrePorCodMov.get(cod);
    if (!prev || nombreUsar.length > prev.nombre.length) {
      nombrePorCodMov.set(cod, { codigo, codOp: codOpCuenta, nombre: nombreUsar });
    }
  }

  for (const row of todosCodigos) {
    const cod = String(row.codOperativo ?? "").trim();
    if (!cod || cubiertos.has(cod)) continue;

    const cuentaCat = encontrarCuentaPorCodigoMovimientoExtracto(cod, cuentasDb);
    if (cuentaCat) {
      const cg = String(cuentaCat.codigo ?? "").trim() || cod;
      if (porCodigoCuenta.has(cg)) {
        cubiertos.add(cod);
        continue;
      }
      const nom = String(cuentaCat.nombre ?? "").trim() || `Cuenta ${cg}`;
      resultado.push({
        cuentaCodigo: cg,
        codigo: cg,
        codOperativo: normalizarUnaLinea(cuentaCat.codOperativo ?? "") || cg,
        nombre: nom,
      });
      porCodigoCuenta.set(cg, resultado[resultado.length - 1]!);
      tokensCubiertosPorCuentaBancaria(cuentaCat).forEach((t) => cubiertos.add(t));
      continue;
    }

    const info = nombrePorCodMov.get(cod);
    if (!info) continue;
    resultado.push({
      cuentaCodigo: info.codigo,
      codigo: info.codigo,
      codOperativo: info.codOp,
      nombre: info.nombre,
    });
    cubiertos.add(cod);
    tokensCubiertosPorFila(resultado[resultado.length - 1]!).forEach((t) => cubiertos.add(t));
  }

  const codigosPendientes = todosCodigos
    .map((row) => String(row.codOperativo ?? "").trim())
    .filter((cod) => cod && !cubiertos.has(cod));

  if (codigosPendientes.length > 0) {
    const movsConcepto = await prisma.movimientoExtracto.findMany({
      where: { codOperativo: { in: codigosPendientes } },
      select: { codOperativo: true, concepto: true },
    });
    const mejorConcepto = new Map<string, string>();
    for (const m of movsConcepto) {
      const c = String(m.codOperativo ?? "").trim();
      const con = normalizarUnaLinea(String(m.concepto ?? ""));
      if (!con || con === c) continue;
      const prev = mejorConcepto.get(c);
      if (!prev || con.length > prev.length) mejorConcepto.set(c, con);
    }
    const MAX_NOMBRE = 160;
    for (const cod of codigosPendientes) {
      let nombre = mejorConcepto.get(cod) ?? "";
      if (nombre.length > MAX_NOMBRE) {
        nombre = nombre.slice(0, MAX_NOMBRE - 1) + "…";
      }
      if (!nombre.trim()) {
        nombre = `Código ${cod} — cargá nombre en Cuentas bancarias`;
      }
      resultado.push({
        cuentaCodigo: cod,
        codigo: cod,
        codOperativo: cod,
        nombre,
      });
      cubiertos.add(cod);
    }
  }

  resultado.sort((a, b) =>
    a.cuentaCodigo.localeCompare(b.cuentaCodigo, "es", { numeric: true })
  );

  return NextResponse.json(resultado);
}
