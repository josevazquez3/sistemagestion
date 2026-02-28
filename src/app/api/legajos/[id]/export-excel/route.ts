import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import ExcelJS from "exceljs";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const roles = (session?.user as { roles?: string[] })?.roles ?? [];
  if (!roles.includes("ADMIN") && !roles.includes("RRHH") && !roles.includes("SECRETARIA")) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { id } = await params;
  const legajo = await prisma.legajo.findUnique({
    where: { id },
    include: { contactos: { include: { telefonos: true } } },
  });

  if (!legajo) return NextResponse.json({ error: "Legajo no encontrado" }, { status: 404 });

  const parentescoLabel: Record<string, string> = { CONYUGE: "Cónyuge", HIJO: "Hijo/a", PADRE: "Padre", MADRE: "Madre", HERMANO: "Hermano/a", OTRO: "Otro" };

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Legajo");

  const rows: (string | number | null)[][] = [
    ["Nº Legajo", legajo.numeroLegajo],
    ["Apellidos", legajo.apellidos],
    ["Nombres", legajo.nombres],
    ["DNI", legajo.dni],
    ["CUIL", legajo.cuil ?? ""],
    ["Calle", legajo.calle],
    ["Número", legajo.numero],
    ["Casa", legajo.casa ?? ""],
    ["Departamento", legajo.departamento ?? ""],
    ["Piso", legajo.piso ?? ""],
    ["Localidad", legajo.localidad],
    ["Código Postal", legajo.codigoPostal],
    ["Fecha Alta", legajo.fechaAlta.toISOString().split("T")[0]],
    ["Fecha Baja", legajo.fechaBaja ? legajo.fechaBaja.toISOString().split("T")[0] : ""],
    ["Motivo Baja", legajo.motivoBaja ?? ""],
    ["Celular", legajo.celular ?? ""],
    [],
  ];

  if (legajo.contactos.length > 0) {
    rows.push(["--- CONTACTOS ADICIONALES ---"]);
    for (const c of legajo.contactos) {
      rows.push(["Nombres", c.nombres, "Apellidos", c.apellidos, "Parentesco", parentescoLabel[c.parentesco] ?? c.parentesco]);
      rows.push(["Calle", c.calle ?? "", "Número", c.numero ?? "", "Casa", c.casa ?? "", "Dpto", c.departamento ?? "", "Piso", c.piso ?? ""]);
      rows.push(["Teléfonos", ...c.telefonos.map((t) => t.numero)]);
      rows.push([]);
    }
  }

  for (const row of rows) {
    ws.addRow(row);
  }

  const buf = await wb.xlsx.writeBuffer();

  return new NextResponse(Buffer.from(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="legajo-${legajo.numeroLegajo}.xlsx"`,
    },
  });
}
