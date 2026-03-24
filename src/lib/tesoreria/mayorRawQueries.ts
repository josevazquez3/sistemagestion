import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/** CRUD vía SQL: funciona aunque el cliente Prisma no tenga aún `mayorCuenta` / `mayorMovimiento`. */

let mayorSchemaReady: Promise<void> | undefined;

/**
 * Si `migrate deploy` no corrió en esta BD, las tablas no existen (42P01).
 * DDL idempotente alineado con `20260320130000_mayor_cuentas_movimientos`.
 */
export async function ensureMayorTables(): Promise<void> {
  if (!mayorSchemaReady) {
    mayorSchemaReady = (async () => {
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "mayor_cuentas" (
          "id" SERIAL NOT NULL,
          "nombre" TEXT NOT NULL,
          "orden" INTEGER NOT NULL DEFAULT 0,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "mayor_cuentas_pkey" PRIMARY KEY ("id")
        );
      `);
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "mayor_movimientos" (
          "id" SERIAL NOT NULL,
          "cuentaId" INTEGER NOT NULL,
          "fecha" TIMESTAMP(3),
          "concepto" TEXT NOT NULL,
          "importe" DOUBLE PRECISION NOT NULL,
          "origen" TEXT NOT NULL,
          "origenId" INTEGER,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "mayor_movimientos_pkey" PRIMARY KEY ("id")
        );
      `);
      await prisma.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS "mayor_movimientos_cuentaId_idx" ON "mayor_movimientos"("cuentaId");
      `);
      await prisma.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS "mayor_movimientos_origen_origenId_idx" ON "mayor_movimientos"("origen", "origenId");
      `);
      await prisma.$executeRawUnsafe(`
        CREATE UNIQUE INDEX IF NOT EXISTS "mayor_movimientos_origen_origenId_key" ON "mayor_movimientos"("origen", "origenId");
      `);
      await prisma.$executeRawUnsafe(`
        DO $f$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM pg_constraint WHERE conname = 'mayor_movimientos_cuentaId_fkey'
          ) THEN
            ALTER TABLE "mayor_movimientos"
              ADD CONSTRAINT "mayor_movimientos_cuentaId_fkey"
              FOREIGN KEY ("cuentaId") REFERENCES "mayor_cuentas"("id")
              ON DELETE CASCADE ON UPDATE CASCADE;
          END IF;
        END $f$;
      `);
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "mayor_reglas" (
          "id" SERIAL NOT NULL,
          "palabra" TEXT NOT NULL,
          "cuentaId" INTEGER NOT NULL,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "mayor_reglas_pkey" PRIMARY KEY ("id")
        );
      `);
      await prisma.$executeRawUnsafe(`
        CREATE UNIQUE INDEX IF NOT EXISTS "mayor_reglas_palabra_key" ON "mayor_reglas"("palabra");
      `);
      await prisma.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS "mayor_reglas_cuentaId_idx" ON "mayor_reglas"("cuentaId");
      `);
      await prisma.$executeRawUnsafe(`
        DO $f$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM pg_constraint WHERE conname = 'mayor_reglas_cuentaId_fkey'
          ) THEN
            ALTER TABLE "mayor_reglas"
              ADD CONSTRAINT "mayor_reglas_cuentaId_fkey"
              FOREIGN KEY ("cuentaId") REFERENCES "mayor_cuentas"("id")
              ON DELETE CASCADE ON UPDATE CASCADE;
          END IF;
        END $f$;
      `);
    })().catch((err) => {
      mayorSchemaReady = undefined;
      throw err;
    });
  }
  await mayorSchemaReady;
}

async function withMayorSchema<T>(run: () => Promise<T>): Promise<T> {
  await ensureMayorTables();
  return run();
}

export type MayorCuentaRow = {
  id: number;
  nombre: string;
  orden: number;
  createdAt: Date;
};

export type MayorMovRow = {
  id: number;
  cuentaId: number;
  fecha: Date | null;
  concepto: string;
  importe: number;
  origen: string;
  origenId: number | null;
  createdAt: Date;
  cuentaNombre: string;
};

export async function listMayorCuentas(): Promise<MayorCuentaRow[]> {
  return withMayorSchema(() =>
    prisma.$queryRaw<MayorCuentaRow[]>(Prisma.sql`
    SELECT id, nombre, orden, "createdAt"
    FROM mayor_cuentas
    ORDER BY orden ASC, id ASC
  `)
  );
}

export async function nextOrdenMayorCuenta(): Promise<number> {
  return withMayorSchema(async () => {
    const r = await prisma.$queryRaw<[{ max: number | null }]>(Prisma.sql`
    SELECT MAX(orden) AS max FROM mayor_cuentas
  `);
    return (r[0]?.max ?? 0) + 1;
  });
}

export async function insertMayorCuenta(
  nombre: string,
  orden: number
): Promise<MayorCuentaRow> {
  return withMayorSchema(async () => {
    const rows = await prisma.$queryRaw<MayorCuentaRow[]>(Prisma.sql`
    INSERT INTO mayor_cuentas (nombre, orden)
    VALUES (${nombre}, ${orden})
    RETURNING id, nombre, orden, "createdAt"
  `);
    const row = rows[0];
    if (!row) throw new Error("INSERT mayor_cuentas sin fila");
    return row;
  });
}

export async function findMayorCuentaById(
  id: number
): Promise<MayorCuentaRow | null> {
  return withMayorSchema(async () => {
    const rows = await prisma.$queryRaw<MayorCuentaRow[]>(Prisma.sql`
    SELECT id, nombre, orden, "createdAt"
    FROM mayor_cuentas
    WHERE id = ${id}
    LIMIT 1
  `);
    return rows[0] ?? null;
  });
}

export async function updateMayorCuenta(
  id: number,
  nombre: string,
  orden: number
): Promise<MayorCuentaRow | null> {
  return withMayorSchema(async () => {
    const rows = await prisma.$queryRaw<MayorCuentaRow[]>(Prisma.sql`
    UPDATE mayor_cuentas
    SET nombre = ${nombre}, orden = ${orden}
    WHERE id = ${id}
    RETURNING id, nombre, orden, "createdAt"
  `);
    return rows[0] ?? null;
  });
}

export async function deleteMayorCuenta(id: number): Promise<boolean> {
  return withMayorSchema(async () => {
    const rows = await prisma.$queryRaw<{ id: number }[]>(Prisma.sql`
    DELETE FROM mayor_cuentas
    WHERE id = ${id}
    RETURNING id
  `);
    return rows.length > 0;
  });
}

/** Movimientos cuya `fecha` cae en el rango inclusive [inicio, fin] (mediodía UTC). */
export async function listMayorMovimientosEnRango(
  inicio: Date,
  fin: Date
): Promise<MayorMovRow[]> {
  return withMayorSchema(() =>
    prisma.$queryRaw<MayorMovRow[]>(Prisma.sql`
    SELECT m.id, m."cuentaId", m.fecha, m.concepto, m.importe, m.origen, m."origenId", m."createdAt",
           c.nombre AS "cuentaNombre"
    FROM mayor_movimientos m
    INNER JOIN mayor_cuentas c ON c.id = m."cuentaId"
    WHERE m.fecha >= ${inicio} AND m.fecha <= ${fin}
    ORDER BY m.fecha ASC NULLS LAST, m.id ASC
  `)
  );
}

export async function findMayorMovimientoByOrigen(
  origen: string,
  origenId: number
): Promise<{ id: number } | null> {
  return withMayorSchema(async () => {
    const rows = await prisma.$queryRaw<{ id: number }[]>(Prisma.sql`
    SELECT id FROM mayor_movimientos
    WHERE origen = ${origen} AND "origenId" = ${origenId}
    LIMIT 1
  `);
    return rows[0] ?? null;
  });
}

export async function insertMayorMovimiento(params: {
  cuentaId: number;
  fecha: Date;
  concepto: string;
  importe: number;
  origen: string;
  origenId: number | null;
}): Promise<MayorMovRow> {
  const { cuentaId, fecha, concepto, importe, origen, origenId } = params;
  return withMayorSchema(async () => {
    const rows = await prisma.$queryRaw<
      Omit<MayorMovRow, "cuentaNombre">[]
    >(Prisma.sql`
    INSERT INTO mayor_movimientos ("cuentaId", fecha, concepto, importe, origen, "origenId")
    VALUES (${cuentaId}, ${fecha}, ${concepto}, ${importe}, ${origen}, ${origenId})
    RETURNING id, "cuentaId", fecha, concepto, importe, origen, "origenId", "createdAt"
  `);
    const mov = rows[0];
    if (!mov) throw new Error("INSERT mayor_movimientos sin fila");
    const c = await findMayorCuentaById(mov.cuentaId);
    return {
      ...mov,
      cuentaNombre: c?.nombre ?? "",
    };
  });
}

export async function findMayorMovimientoById(
  id: number
): Promise<MayorMovRow | null> {
  return withMayorSchema(async () => {
    const rows = await prisma.$queryRaw<MayorMovRow[]>(Prisma.sql`
    SELECT m.id, m."cuentaId", m.fecha, m.concepto, m.importe, m.origen, m."origenId", m."createdAt",
           c.nombre AS "cuentaNombre"
    FROM mayor_movimientos m
    INNER JOIN mayor_cuentas c ON c.id = m."cuentaId"
    WHERE m.id = ${id}
    LIMIT 1
  `);
    return rows[0] ?? null;
  });
}

export async function updateMayorMovimiento(
  id: number,
  cuentaId: number,
  concepto: string,
  importe: number,
  fecha: Date | null
): Promise<MayorMovRow | null> {
  return withMayorSchema(async () => {
    const rows = await prisma.$queryRaw<
      Omit<MayorMovRow, "cuentaNombre">[]
    >(Prisma.sql`
    UPDATE mayor_movimientos
    SET "cuentaId" = ${cuentaId}, concepto = ${concepto}, importe = ${importe}, fecha = ${fecha}
    WHERE id = ${id}
    RETURNING id, "cuentaId", fecha, concepto, importe, origen, "origenId", "createdAt"
  `);
    const mov = rows[0];
    if (!mov) return null;
    const c = await findMayorCuentaById(mov.cuentaId);
    return {
      ...mov,
      cuentaNombre: c?.nombre ?? "",
    };
  });
}

export async function deleteMayorMovimiento(id: number): Promise<boolean> {
  return withMayorSchema(async () => {
    const rows = await prisma.$queryRaw<{ id: number }[]>(Prisma.sql`
    DELETE FROM mayor_movimientos
    WHERE id = ${id}
    RETURNING id
  `);
    return rows.length > 0;
  });
}
