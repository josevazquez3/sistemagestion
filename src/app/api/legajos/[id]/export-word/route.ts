import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Document, Packer, Paragraph, TextRun } from "docx";

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

  const children: Paragraph[] = [
    new Paragraph({ text: "FICHA DE LEGAJO", heading: "Heading1", spacing: { after: 400 } }),
    new Paragraph({ text: `Nº Legajo: ${legajo.numeroLegajo}`, spacing: { after: 200 } }),
    new Paragraph({ children: [new TextRun({ text: "DATOS PERSONALES", bold: true })], spacing: { before: 300, after: 200 } }),
    new Paragraph({ text: `Apellidos: ${legajo.apellidos}`, spacing: { after: 100 } }),
    new Paragraph({ text: `Nombres: ${legajo.nombres}`, spacing: { after: 100 } }),
    new Paragraph({ text: `DNI: ${legajo.dni}`, spacing: { after: 100 } }),
    new Paragraph({ text: `CUIL: ${legajo.cuil ?? "-"}`, spacing: { after: 100 } }),
    new Paragraph({ text: `Celular: ${legajo.celular ?? "-"}`, spacing: { after: 300 } }),
    new Paragraph({ children: [new TextRun({ text: "DIRECCIÓN", bold: true })], spacing: { before: 200, after: 200 } }),
    new Paragraph({ text: `${legajo.calle} ${legajo.numero}${legajo.casa ? ` ${legajo.casa}` : ""}`, spacing: { after: 100 } }),
    new Paragraph({ text: legajo.departamento || legajo.piso ? `Dpto: ${legajo.departamento ?? "-"} Piso: ${legajo.piso ?? "-"}` : "", spacing: { after: 100 } }),
    new Paragraph({ text: `${legajo.localidad} (CP ${legajo.codigoPostal})`, spacing: { after: 300 } }),
    new Paragraph({ children: [new TextRun({ text: "FECHAS", bold: true })], spacing: { before: 200, after: 200 } }),
    new Paragraph({ text: `Fecha de Alta: ${legajo.fechaAlta.toISOString().split("T")[0]}`, spacing: { after: 100 } }),
    legajo.fechaBaja
      ? new Paragraph({ text: `Fecha de Baja: ${legajo.fechaBaja.toISOString().split("T")[0]} - Motivo: ${legajo.motivoBaja ?? ""}`, spacing: { after: 200 } })
      : new Paragraph({ text: "Estado: Activo", spacing: { after: 200 } }),
  ];

  if (legajo.contactos.length > 0) {
    children.push(new Paragraph({ children: [new TextRun({ text: "CONTACTOS ADICIONALES", bold: true })], spacing: { before: 400, after: 200 } }));
    for (const c of legajo.contactos) {
      children.push(new Paragraph({ text: `${c.nombres} ${c.apellidos} - ${parentescoLabel[c.parentesco] ?? c.parentesco}`, spacing: { after: 100 } }));
      if (c.calle || c.numero) children.push(new Paragraph({ text: `  Dirección: ${c.calle ?? ""} ${c.numero ?? ""}`, spacing: { after: 100 } }));
      if (c.telefonos.length > 0) children.push(new Paragraph({ text: `  Tel: ${c.telefonos.map((t) => t.numero).join(", ")}`, spacing: { after: 200 } }));
    }
  }

  const doc = new Document({ sections: [{ children }] });
  const buf = await Packer.toBuffer(doc);

  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="legajo-${legajo.numeroLegajo}.docx"`,
    },
  });
}
