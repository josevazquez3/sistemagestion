import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { prisma } from "@/lib/prisma";
import { canAccess, ensureInformeTables, getRolesFromSession, parseId } from "../../../_shared";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const roles = await getRolesFromSession();
  if (!canAccess(roles)) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  await ensureInformeTables();
  const id = parseId((await params).id);
  if (id == null) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

  try {
    const rows = await prisma.$queryRawUnsafe<Array<{ nombreArchivo: string; sheetName: string; sheetData: unknown }>>(
      `SELECT "nombreArchivo","sheetName","sheetData" FROM "HistorialInformeTesoreria" WHERE "id" = $1`,
      id
    );
    const row = rows[0];
    if (!row) return NextResponse.json({ error: "Registro no encontrado" }, { status: 404 });

    const data = Array.isArray(row.sheetData) ? (row.sheetData as unknown[][]) : [];
    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, row.sheetName || "Informe");
    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${row.nombreArchivo.replace(/"/g, "")}"`,
      },
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error al exportar" }, { status: 500 });
  }
}

