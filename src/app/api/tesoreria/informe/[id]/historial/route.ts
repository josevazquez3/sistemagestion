import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { computeInformeDatos } from "@/lib/tesoreria/computeInformeDatos";
import {
  buildInformeExcelPropsFromSnapshot,
  buildInformeSheetAoa,
} from "@/lib/tesoreria/informeExcelAoa";
import { canAccess, ensureInformeTables, getRolesFromSession, parseId } from "../../_shared";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const roles = await getRolesFromSession();
  if (!canAccess(roles)) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  await ensureInformeTables();

  const id = parseId((await params).id);
  if (id == null) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

  const prismaAny = prisma as any;
  try {
    const informe = await prismaAny.informeTesoreria.findUnique({
      where: { id },
      include: {
        egresos: true,
        compromisos: true,
        textBoxes: true,
      },
    });
    if (!informe) {
      return NextResponse.json({ error: "Informe no encontrado" }, { status: 404 });
    }

    const fd = informe.fechaDesde as Date;
    const fh = informe.fechaHasta as Date;

    const datos = await computeInformeDatos({
      informeId: id,
      fechaDesde: fd,
      fechaHasta: fh,
      certDesde: fd,
      certHasta: fh,
    });

    const props = buildInformeExcelPropsFromSnapshot(
      {
        fechaDesde: fd,
        fechaHasta: fh,
        egresos: informe.egresos,
        compromisos: informe.compromisos,
        textBoxes: informe.textBoxes,
      },
      datos
    );

    const sheetData = buildInformeSheetAoa(props);
    const desdeStr = fd.toISOString().slice(0, 10);
    const hastaStr = fh.toISOString().slice(0, 10);
    const nombreArchivo = `Informe_Tesoreria_${desdeStr}_${hastaStr}_id${id}.xlsx`;
    const fechaArchivo = fh;

    const row = await prisma.$transaction(async (tx) => {
      const inserted = await tx.$queryRawUnsafe<
        Array<{ id: number; nombreArchivo: string; fechaArchivo: Date | null; createdAt: Date }>
      >(
        `INSERT INTO "HistorialInformeTesoreria" ("nombreArchivo","fechaArchivo","sheetName","sheetData")
         VALUES ($1,$2,$3,$4::jsonb)
         RETURNING "id","nombreArchivo","fechaArchivo","createdAt"`,
        nombreArchivo,
        fechaArchivo,
        "Informe",
        JSON.stringify(sheetData)
      );
      const historialRow = inserted[0]!;
      await (tx as any).informeTesoreria.delete({ where: { id } });
      return historialRow;
    });

    return NextResponse.json({
      id: row.id,
      nombreArchivo: row.nombreArchivo,
      fechaArchivo: row.fechaArchivo ? new Date(row.fechaArchivo).toISOString() : null,
      createdAt: new Date(row.createdAt).toISOString(),
      informeArchivado: true,
    });
  } catch (err) {
    console.error("informe/[id]/historial POST:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error al guardar en historial" },
      { status: 500 }
    );
  }
}
