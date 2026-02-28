import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { jsPDF } from "jspdf";

const PARENTESCO_LABEL: Record<string, string> = {
  CONYUGE: "Cónyuge",
  HIJO: "Hijo/a",
  PADRE: "Padre",
  MADRE: "Madre",
  HERMANO: "Hermano/a",
  OTRO: "Otro",
};

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

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const margin = 20;
  let y = 20;

  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("FICHA DE LEGAJO", margin, y);
  y += 10;

  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.text(`Nº Legajo: ${legajo.numeroLegajo}`, margin, y);
  y += 8;

  doc.setFont("helvetica", "bold");
  doc.text("DATOS PERSONALES", margin, y);
  y += 7;
  doc.setFont("helvetica", "normal");
  doc.text(`Apellidos: ${legajo.apellidos}`, margin, y);
  y += 6;
  doc.text(`Nombres: ${legajo.nombres}`, margin, y);
  y += 6;
  doc.text(`DNI: ${legajo.dni}`, margin, y);
  y += 6;
  doc.text(`CUIL: ${legajo.cuil ?? "-"}`, margin, y);
  y += 6;
  doc.text(`Celular: ${legajo.celular ?? "-"}`, margin, y);
  y += 10;

  doc.setFont("helvetica", "bold");
  doc.text("DIRECCIÓN", margin, y);
  y += 7;
  doc.setFont("helvetica", "normal");
  doc.text(`${legajo.calle} ${legajo.numero}${legajo.casa ? ` ${legajo.casa}` : ""}`, margin, y);
  y += 6;
  if (legajo.departamento || legajo.piso) {
    doc.text(`Dpto: ${legajo.departamento ?? "-"}  Piso: ${legajo.piso ?? "-"}`, margin, y);
    y += 6;
  }
  doc.text(`${legajo.localidad} (CP ${legajo.codigoPostal})`, margin, y);
  y += 10;

  doc.setFont("helvetica", "bold");
  doc.text("FECHAS", margin, y);
  y += 7;
  doc.setFont("helvetica", "normal");
  doc.text(`Fecha de Alta: ${legajo.fechaAlta.toISOString().split("T")[0]}`, margin, y);
  y += 6;
  if (legajo.fechaBaja) {
    doc.text(`Fecha de Baja: ${legajo.fechaBaja.toISOString().split("T")[0]}`, margin, y);
    y += 6;
    doc.text(`Motivo: ${legajo.motivoBaja ?? "-"}`, margin, y);
    y += 8;
  } else {
    doc.text("Estado: Activo", margin, y);
    y += 8;
  }

  if (legajo.contactos.length > 0) {
    if (y > 250) {
      doc.addPage();
      y = 20;
    }
    doc.setFont("helvetica", "bold");
    doc.text("CONTACTOS ADICIONALES", margin, y);
    y += 7;
    doc.setFont("helvetica", "normal");
    for (const c of legajo.contactos) {
      if (y > 270) {
        doc.addPage();
        y = 20;
      }
      doc.text(`${c.nombres} ${c.apellidos} - ${PARENTESCO_LABEL[c.parentesco] ?? c.parentesco}`, margin, y);
      y += 6;
      if (c.calle || c.numero) {
        doc.text(`  Dirección: ${c.calle ?? ""} ${c.numero ?? ""}`, margin, y);
        y += 6;
      }
      if (c.telefonos.length > 0) {
        doc.text(`  Tel: ${c.telefonos.map((t) => t.numero).join(", ")}`, margin, y);
        y += 6;
      }
      y += 4;
    }
  }

  const buf = doc.output("arraybuffer");

  return new NextResponse(buf, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="legajo-${legajo.numeroLegajo}.pdf"`,
    },
  });
}
