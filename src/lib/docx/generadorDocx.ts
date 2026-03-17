import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  convertInchesToTwip,
} from "docx";

function htmlAParrafos(html: string): Paragraph[] {
  const parrafos: Paragraph[] = [];
  const regex = /<(h1|h2|h3|p|div)[^>]*>([\s\S]*?)<\/\1>/gi;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(html)) !== null) {
    const tag = match[1]?.toLowerCase();
    const inner = match[2]?.replace(/<[^>]+>/g, "").trim() ?? "";
    if (!inner) continue;

    const esBold = /<strong>|<b>/i.test(match[2] ?? "");

    parrafos.push(
      new Paragraph({
        heading:
          tag === "h1"
            ? HeadingLevel.HEADING_1
            : tag === "h2"
            ? HeadingLevel.HEADING_2
            : tag === "h3"
            ? HeadingLevel.HEADING_3
            : undefined,
        children: [
          new TextRun({
            text: inner,
            bold: esBold,
            size: 24,
          }),
        ],
        spacing: { after: convertInchesToTwip(0.1) },
      })
    );
  }

  if (parrafos.length === 0) {
    const texto = html.replace(/<[^>]+>/g, "").trim();
    parrafos.push(
      new Paragraph({
        children: [new TextRun({ text: texto || "", size: 24 })],
      })
    );
  }

  return parrafos;
}

export async function generarDocxDesdeHtml(
  html: string,
  titulo?: string
): Promise<Buffer> {
  const doc = new Document({
    creator: "SistemaGestion - Consejo Superior CMBA",
    title: titulo || "Modelo de Oficio",
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: convertInchesToTwip(1),
              right: convertInchesToTwip(1),
              bottom: convertInchesToTwip(1),
              left: convertInchesToTwip(1.25),
            },
          },
        },
        children: htmlAParrafos(html),
      },
    ],
  });

  return await Packer.toBuffer(doc);
}

