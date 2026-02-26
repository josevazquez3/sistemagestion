/**
 * Genera el documento DOCX de solicitud de vacaciones según el formato institucional.
 * Usa la librería docx para crear el archivo Word.
 */

import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  AlignmentType,
  UnderlineType,
} from "docx";
import { prisma } from "@/lib/prisma";
import {
  formatearFecha,
  formatearFechaLarga,
  numeroALetras,
} from "@/lib/vacaciones.utils";

/** Configuración de fuente estándar del documento (Times New Roman 12pt) */
const RUN_OPTS = {
  font: "Times New Roman",
  size: 24, // 12pt en half-points
} as const;

/**
 * Genera el Buffer del documento DOCX para una solicitud de vacaciones.
 * @param solicitudId - ID de la solicitud
 * @returns Buffer listo para descarga o null si no existe
 */
export async function generarDocumentoVacaciones(
  solicitudId: number
): Promise<Buffer | null> {
  const solicitud = await prisma.solicitudVacaciones.findUnique({
    where: { id: solicitudId },
    include: { legajo: true },
  });

  if (!solicitud) return null;

  const config = await prisma.configuracionVacaciones.findUnique({
    where: { legajoId: solicitud.legajoId },
  });

  if (!config) return null;

  const fechaGeneracion = new Date();
  const fechaLarga = formatearFechaLarga(fechaGeneracion);
  const desdeFormato = formatearFecha(solicitud.fechaDesde);
  const hastaFormato = formatearFecha(solicitud.fechaHasta);
  const anio = solicitud.fechaDesde.getFullYear();
  const diasEnLetras = numeroALetras(solicitud.diasSolicitados);
  const nombreEmpleado = (
    `${solicitud.legajo.nombres} ${solicitud.legajo.apellidos}`
  ).toUpperCase();

  const children = [
    // LA PLATA, [DD de mes de YYYY].- (alineado a la derecha)
    new Paragraph({
      alignment: AlignmentType.RIGHT,
      children: [
        new TextRun({
          text: `LA PLATA, ${fechaLarga}.-`,
          font: RUN_OPTS.font,
          size: RUN_OPTS.size,
        }),
      ],
      spacing: { after: 400 },
    }),

    // Líneas del encabezado (destinatario)
    new Paragraph({
      children: [
        new TextRun({
          text: "Al Sr. Secretario General",
          font: RUN_OPTS.font,
          size: RUN_OPTS.size,
        }),
      ],
      spacing: { after: 100 },
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: "Del Colegio de Médicos de la",
          font: RUN_OPTS.font,
          size: RUN_OPTS.size,
        }),
      ],
      spacing: { after: 100 },
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: "Prov. de Buenos Aires-Consejo Superior",
          font: RUN_OPTS.font,
          size: RUN_OPTS.size,
        }),
      ],
      spacing: { after: 100 },
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: `Dr. ${config.secretarioGeneral}`,
          font: RUN_OPTS.font,
          size: RUN_OPTS.size,
        }),
      ],
      spacing: { after: 400 },
    }),

    // S / D.- con underline
    new Paragraph({
      children: [
        new TextRun({
          text: "S / D.-",
          font: RUN_OPTS.font,
          size: RUN_OPTS.size,
          underline: { type: UnderlineType.SINGLE },
        }),
      ],
      spacing: { after: 400 },
    }),

    // Cuerpo del texto (justificado, sangría primer párrafo)
    new Paragraph({
      alignment: AlignmentType.JUSTIFIED,
      indent: { firstLine: 720 },
      spacing: { line: 360, lineRule: "auto", after: 400 },
      children: [
        new TextRun({
          text: `    Me dirijo a Ud., con el objeto de solicitarle me autorice los ${diasEnLetras} (${solicitud.diasSolicitados}) `,
          font: RUN_OPTS.font,
          size: RUN_OPTS.size,
        }),
        new TextRun({
          text: `días de la licencia anual ordinaria ${anio}, en el siguiente período: desde el ${desdeFormato} `,
          font: RUN_OPTS.font,
          size: RUN_OPTS.size,
        }),
        new TextRun({
          text: `y hasta el ${hastaFormato} inclusive, restando (${solicitud.diasRestantes}) de mis vacaciones.`,
          font: RUN_OPTS.font,
          size: RUN_OPTS.size,
        }),
      ],
    }),

    new Paragraph({
      children: [
        new TextRun({
          text: "Muy atentamente.-",
          font: RUN_OPTS.font,
          size: RUN_OPTS.size,
        }),
      ],
      spacing: { after: 400, before: 200 },
    }),

    new Paragraph({ text: "", spacing: { after: 200 } }),
    new Paragraph({ text: "", spacing: { after: 200 } }),

    // Nombre del empleado alineado a la derecha
    new Paragraph({
      alignment: AlignmentType.RIGHT,
      children: [
        new TextRun({
          text: nombreEmpleado,
          font: RUN_OPTS.font,
          size: RUN_OPTS.size,
        }),
      ],
      spacing: { after: 200 },
    }),
  ];

  const doc = new Document({
    sections: [{ children }],
  });

  const buf = await Packer.toBuffer(doc);
  return Buffer.from(buf);
}
