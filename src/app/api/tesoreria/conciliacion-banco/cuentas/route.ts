import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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

export async function GET(_req: NextRequest) {
  const session = await auth();
  const roles = (session?.user as { roles?: string[] })?.roles ?? [];
  if (!ROLES.some((r) => roles.includes(r))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const resultado: CuentaFila[] = [];
  const porCodigoCuenta = new Map<string, CuentaFila>();

  const cuentasDb = await prisma.cuentaBancaria.findMany({
    where: { activo: true },
    orderBy: [{ codigo: "asc" }, { id: "asc" }],
  });

  for (const r of cuentasDb) {
    const codigoRaw = String(r.codigo ?? "").trim();
    const codOpRaw = normalizarUnaLinea(r.codOperativo ?? "");
    const nombreRaw = String(r.nombre ?? "").trim();
    const primerToken = codOpRaw.split(/\s+/).filter(Boolean)[0] ?? "";
    const codigoFinal = codigoRaw || primerToken || "S/C";
    const codOpDisplay = codOpRaw;

    if (!nombreValido(nombreRaw, codigoFinal, codOpDisplay || codigoFinal)) continue;

    if (porCodigoCuenta.has(codigoFinal)) continue;

    const fila: CuentaFila = {
      cuentaCodigo: codigoFinal,
      codigo: codigoFinal,
      codOperativo: codOpDisplay,
      nombre: nombreRaw,
    };
    porCodigoCuenta.set(codigoFinal, fila);
    resultado.push(fila);
  }

  const cubiertos = new Set<string>();
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
    if (!nombreValido(nombre, codigo, cod)) continue;
    const prev = nombrePorCodMov.get(cod);
    if (!prev || prev.nombre.length < nombre.length) {
      nombrePorCodMov.set(cod, { codigo, codOp: codOpCuenta, nombre });
    }
  }

  const todosCodigos = await prisma.movimientoExtracto.findMany({
    where: { codOperativo: { not: null } },
    select: { codOperativo: true },
    distinct: ["codOperativo"],
    orderBy: { codOperativo: "asc" },
  });

  for (const row of todosCodigos) {
    const cod = String(row.codOperativo ?? "").trim();
    if (!cod || cubiertos.has(cod)) continue;
    const info = nombrePorCodMov.get(cod);
    if (!info) continue;
    resultado.push({
      cuentaCodigo: cod,
      codigo: cod,
      codOperativo: cod,
      nombre: info.nombre,
    });
    cubiertos.add(cod);
  }

  /** Códigos que aparecen en el extracto pero sin fila en catálogo ni cuenta vinculada */
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
      const cod = String(m.codOperativo ?? "").trim();
      const con = normalizarUnaLinea(String(m.concepto ?? ""));
      if (!con || con === cod) continue;
      const prev = mejorConcepto.get(cod);
      if (!prev || con.length > prev.length) mejorConcepto.set(cod, con);
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
