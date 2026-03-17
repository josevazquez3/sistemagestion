import mammoth from "mammoth";

export async function extraerHtmlDeDocx(buffer: Buffer): Promise<string> {
  const resultado = await mammoth.convertToHtml(
    { buffer },
    {
      styleMap: [
        "p[style-name='Heading 1'] => h1:fresh",
        "p[style-name='Heading 2'] => h2:fresh",
        "b => strong",
        "i => em",
        "u => u",
      ],
    }
  );
  return resultado.value || "<p></p>";
}

