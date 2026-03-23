import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/** Acceso a `cuit_distritos` vía SQL para no depender de `prisma generate` con el modelo nuevo. */

export type CuitDistritoRow = {
  id: number;
  distrito: string;
  cuit: string;
  createdAt: Date;
};

export async function listCuitDistritos(): Promise<CuitDistritoRow[]> {
  return prisma.$queryRaw<CuitDistritoRow[]>(Prisma.sql`
    SELECT id, distrito, cuit, "createdAt"
    FROM "cuit_distritos"
    ORDER BY distrito ASC, id ASC
  `);
}

export async function findCuitDistritoById(
  id: number
): Promise<CuitDistritoRow | null> {
  const rows = await prisma.$queryRaw<CuitDistritoRow[]>(Prisma.sql`
    SELECT id, distrito, cuit, "createdAt"
    FROM "cuit_distritos"
    WHERE id = ${id}
    LIMIT 1
  `);
  return rows[0] ?? null;
}

export async function insertCuitDistrito(
  distrito: string,
  cuit: string
): Promise<CuitDistritoRow> {
  const rows = await prisma.$queryRaw<CuitDistritoRow[]>(Prisma.sql`
    INSERT INTO "cuit_distritos" (distrito, cuit)
    VALUES (${distrito}, ${cuit})
    RETURNING id, distrito, cuit, "createdAt"
  `);
  const row = rows[0];
  if (!row) throw new Error("INSERT cuit_distritos sin fila");
  return row;
}

export async function updateCuitDistrito(
  id: number,
  distrito: string,
  cuit: string
): Promise<CuitDistritoRow | null> {
  const rows = await prisma.$queryRaw<CuitDistritoRow[]>(Prisma.sql`
    UPDATE "cuit_distritos"
    SET distrito = ${distrito}, cuit = ${cuit}
    WHERE id = ${id}
    RETURNING id, distrito, cuit, "createdAt"
  `);
  return rows[0] ?? null;
}

export async function deleteCuitDistrito(id: number): Promise<boolean> {
  const rows = await prisma.$queryRaw<{ id: number }[]>(Prisma.sql`
    DELETE FROM "cuit_distritos"
    WHERE id = ${id}
    RETURNING id
  `);
  return rows.length > 0;
}
