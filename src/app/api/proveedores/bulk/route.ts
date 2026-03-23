import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const ROLES = ["SUPER_ADMIN", "ADMIN", "TESORERO"] as const;

function canAccess(roles: string[]) {
  return ROLES.some((r) => roles.includes(r));
}

type BulkRow = Record<string, unknown>;
type NormalizedRow = {
  proveedor: string;
  nombreContacto: string | null;
  alias: string | null;
  cuit: string | null;
  cuentaDebitoTipoNum: string | null;
  banco: string | null;
  direccion: string | null;
  ciudad: string | null;
  telefono: string | null;
  email: string | null;
  formaPago: string | null;
  cbu: string | null;
  __row: number;
};

function normalizeCell(v: unknown) {
  const s = String(v ?? "").trim();
  return s === "" ? null : s;
}

function normalizeRow(row: BulkRow, index: number): NormalizedRow | null {
  const proveedor =
    String(row["Proveedor"] ?? row["proveedor"] ?? "").trim();
  if (!proveedor || proveedor.toLowerCase() === "proveedor") return null;

  return {
    proveedor,
    nombreContacto: normalizeCell(row["Nombre del contacto principal"] ?? row["nombreContacto"]),
    alias: normalizeCell(row["ALIAS"] ?? row["alias"]),
    cuit: normalizeCell(row["CUIT"] ?? row["cuit"]),
    cuentaDebitoTipoNum: normalizeCell(row["CTA. DE DEBITO (TIPO Y NUMERO)"] ?? row["cuentaDebitoTipoNum"]),
    banco: normalizeCell(row["BANCO"] ?? row["banco"]),
    direccion: normalizeCell(row["Dirección"] ?? row["direccion"]),
    ciudad: normalizeCell(row["Ciudad"] ?? row["ciudad"]),
    telefono: normalizeCell(row["Teléfono"] ?? row["telefono"]),
    email: normalizeCell(row["Correo electrónico"] ?? row["email"]),
    formaPago: normalizeCell(row["Formas de Pago"] ?? row["formaPago"]),
    cbu: normalizeCell(row["CBU"] ?? row["cbu"]),
    __row: index + 1,
  };
}

export async function POST(req: NextRequest) {
  const session = await auth();
  const roles = (session?.user as { roles?: string[] })?.roles ?? [];
  if (!canAccess(roles)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const overwrite = Boolean(body?.overwrite);
    const rows = Array.isArray(body)
      ? (body as BulkRow[])
      : Array.isArray(body?.rows)
        ? (body.rows as BulkRow[])
        : [];
    const errores: string[] = [];
    let actualizados = 0;

    const mapped = rows
      .map((row, idx) => normalizeRow(row, idx))
      .filter(Boolean) as NormalizedRow[];

    if (mapped.length === 0) {
      return NextResponse.json({
        insertados: 0,
        actualizados: 0,
        errores: ["No hay filas válidas para importar."],
      });
    }

    if (overwrite) {
      let insertados = 0;
      for (const row of mapped) {
        try {
          const cuit = row.cuit?.trim() ?? "";
          if (!cuit) {
            await prisma.proveedor.create({
              data: {
                proveedor: row.proveedor,
                nombreContacto: row.nombreContacto,
                alias: row.alias,
                cuit: row.cuit,
                cuentaDebitoTipoNum: row.cuentaDebitoTipoNum,
                banco: row.banco,
                direccion: row.direccion,
                ciudad: row.ciudad,
                telefono: row.telefono,
                email: row.email,
                formaPago: row.formaPago,
                cbu: row.cbu,
              },
            });
            insertados += 1;
            continue;
          }

          const existing = await prisma.proveedor.findFirst({
            where: { cuit: cuit },
            select: { id: true },
          });

          if (!existing) {
            await prisma.proveedor.create({
              data: {
                proveedor: row.proveedor,
                nombreContacto: row.nombreContacto,
                alias: row.alias,
                cuit: row.cuit,
                cuentaDebitoTipoNum: row.cuentaDebitoTipoNum,
                banco: row.banco,
                direccion: row.direccion,
                ciudad: row.ciudad,
                telefono: row.telefono,
                email: row.email,
                formaPago: row.formaPago,
                cbu: row.cbu,
              },
            });
            insertados += 1;
          } else {
            await prisma.proveedor.update({
              where: { id: existing.id },
              data: {
                proveedor: row.proveedor,
                nombreContacto: row.nombreContacto,
                alias: row.alias,
                cuit: row.cuit,
                cuentaDebitoTipoNum: row.cuentaDebitoTipoNum,
                banco: row.banco,
                direccion: row.direccion,
                ciudad: row.ciudad,
                telefono: row.telefono,
                email: row.email,
                formaPago: row.formaPago,
                cbu: row.cbu,
              },
            });
            actualizados += 1;
          }
        } catch {
          errores.push(`Fila ${row.__row}: no se pudo procesar.`);
        }
      }

      return NextResponse.json({ insertados, actualizados, errores });
    }

    try {
      const res = await prisma.proveedor.createMany({
        data: mapped.map(({ __row, ...item }) => {
          void __row;
          return item;
        }),
        skipDuplicates: false,
      });
      return NextResponse.json({ insertados: res.count, actualizados: 0, errores });
    } catch {
      for (const row of mapped) {
        try {
          await prisma.proveedor.create({
            data: {
              proveedor: row.proveedor,
              nombreContacto: row.nombreContacto,
              alias: row.alias,
              cuit: row.cuit,
              cuentaDebitoTipoNum: row.cuentaDebitoTipoNum,
              banco: row.banco,
              direccion: row.direccion,
              ciudad: row.ciudad,
              telefono: row.telefono,
              email: row.email,
              formaPago: row.formaPago,
              cbu: row.cbu,
            },
          });
        } catch {
          errores.push(`Fila ${row.__row}: no se pudo insertar.`);
        }
      }
      return NextResponse.json({
        insertados: mapped.length - errores.length,
        actualizados: 0,
        errores,
      });
    }
  } catch {
    return NextResponse.json({ error: "Error en la carga masiva." }, { status: 500 });
  }
}
