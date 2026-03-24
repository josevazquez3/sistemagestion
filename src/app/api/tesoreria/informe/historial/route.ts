import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { prisma } from "@/lib/prisma";
import { canAccess, ensureInformeTables, getRolesFromSession } from "../_shared";

type HistorialRow = {
  id: number;
  nombreArchivo: string;
  fechaArchivo: Date | null;
  createdAt: Date;
};

function detectarFechaEnSheetData(sheetData: unknown[][]): Date | null {
  const re = /\b(\d{2})\/(\d{2})\/(\d{4})\b/g;
  for (const row of sheetData) {
    for (const cell of row) {
      const text = String(cell ?? "");
      const m = re.exec(text);
      re.lastIndex = 0;
      if (!m) continue;
      const dd = Number(m[1]);
      const mm = Number(m[2]);
      const yyyy = Number(m[3]);
      if (!dd || !mm || !yyyy) continue;
      return new Date(`${yyyy}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}T12:00:00.000-03:00`);
    }
  }
  return null;
}

export async function GET(req: NextRequest) {
  const roles = await getRolesFromSession();
  if (!canAccess(roles)) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  await ensureInformeTables();

  const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
  try {
    const rows = (q
      ? await prisma.$queryRawUnsafe<HistorialRow[]>(
          `SELECT "id","nombreArchivo","fechaArchivo","createdAt"
           FROM "HistorialInformeTesoreria"
           WHERE "nombreArchivo" ILIKE $1
           ORDER BY COALESCE("fechaArchivo","createdAt") DESC, "id" DESC`,
          `%${q}%`
        )
      : await prisma.$queryRawUnsafe<HistorialRow[]>(
          `SELECT "id","nombreArchivo","fechaArchivo","createdAt"
           FROM "HistorialInformeTesoreria"
           ORDER BY COALESCE("fechaArchivo","createdAt") DESC, "id" DESC`
        )) as HistorialRow[];

    return NextResponse.json(
      rows.map((r) => ({
        id: r.id,
        nombreArchivo: r.nombreArchivo,
        fechaArchivo: r.fechaArchivo ? new Date(r.fechaArchivo).toISOString() : null,
        createdAt: new Date(r.createdAt).toISOString(),
      }))
    );
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error al listar historial" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const roles = await getRolesFromSession();
  if (!canAccess(roles)) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  await ensureInformeTables();

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Formulario inválido" }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Archivo requerido" }, { status: 400 });
  }
  if (!/\.xlsx?$/.test(file.name.toLowerCase())) {
    return NextResponse.json({ error: "Solo se permiten archivos Excel (.xls/.xlsx)" }, { status: 400 });
  }

  try {
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: "array" });
    const sheetName = wb.SheetNames[0];
    if (!sheetName) return NextResponse.json({ error: "El archivo no contiene hojas" }, { status: 400 });
    const ws = wb.Sheets[sheetName];
    const sheetData = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: true, defval: "" });
    const fechaArchivo = detectarFechaEnSheetData(sheetData);

    const inserted = await prisma.$queryRawUnsafe<Array<{ id: number; nombreArchivo: string; fechaArchivo: Date | null; createdAt: Date }>>(
      `INSERT INTO "HistorialInformeTesoreria" ("nombreArchivo","fechaArchivo","sheetName","sheetData")
       VALUES ($1,$2,$3,$4::jsonb)
       RETURNING "id","nombreArchivo","fechaArchivo","createdAt"`,
      file.name,
      fechaArchivo,
      sheetName,
      JSON.stringify(sheetData)
    );
    const row = inserted[0]!;
    return NextResponse.json({
      id: row.id,
      nombreArchivo: row.nombreArchivo,
      fechaArchivo: row.fechaArchivo ? new Date(row.fechaArchivo).toISOString() : null,
      createdAt: new Date(row.createdAt).toISOString(),
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error al importar Excel" }, { status: 500 });
  }
}

