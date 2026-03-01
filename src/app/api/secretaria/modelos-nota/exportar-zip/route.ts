import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { readFile } from "fs/promises";
import path from "path";
import archiver from "archiver";

const ROLES = ["ADMIN", "SECRETARIA"] as const;

function canAccess(roles: string[]) {
  return ROLES.some((r) => roles.includes(r));
}

/** Nombre del ZIP: modelos_notas_YYYYMMDD.zip (fecha Argentina) */
function nombreZip(): string {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(now);
  const y = parts.find((p) => p.type === "year")?.value ?? "";
  const m = parts.find((p) => p.type === "month")?.value ?? "";
  const d = parts.find((p) => p.type === "day")?.value ?? "";
  return `modelos_notas_${y}${m}${d}.zip`;
}

/** POST - Recibe array de ids, devuelve .zip con los .docx seleccionados */
export async function POST(req: NextRequest) {
  const session = await auth();
  const roles = (session?.user as { roles?: string[] })?.roles ?? [];
  if (!canAccess(roles)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const ids = Array.isArray(body.ids)
      ? body.ids.map((x: unknown) => parseInt(String(x), 10)).filter((n: number) => !isNaN(n))
      : [];
    if (ids.length === 0) {
      return NextResponse.json({ error: "Seleccioná al menos un modelo" }, { status: 400 });
    }

    const modelos = await prisma.modeloNota.findMany({
      where: { id: { in: ids } },
    });

    const entries: { name: string; buffer: Buffer }[] = [];
    for (const m of modelos) {
      let buffer: Buffer;
      if (m.contenido && m.contenido.length > 0) {
        buffer = Buffer.from(m.contenido);
      } else {
        try {
          buffer = await readFile(path.join(process.cwd(), "public", m.urlArchivo));
        } catch {
          continue;
        }
      }
      const safeName = (m.nombreArchivo || `modelo-${m.id}.docx`).replace(/[^a-zA-Z0-9._-]/g, "_");
      entries.push({ name: safeName, buffer });
    }

    const archive = archiver("zip", { zlib: { level: 9 } });
    const chunks: Buffer[] = [];
    archive.on("data", (chunk: Buffer) => chunks.push(chunk));

    const zipBuffer = await new Promise<Buffer>((resolvePromise, reject) => {
      archive.on("end", () => resolvePromise(Buffer.concat(chunks)));
      archive.on("error", reject);
      for (const e of entries) {
        archive.append(e.buffer, { name: e.name });
      }
      archive.finalize();
    });

    const filename = nombreZip();
    return new NextResponse(new Uint8Array(zipBuffer), {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (e) {
    console.error("Error generando ZIP:", e);
    return NextResponse.json({ error: "Error al generar ZIP" }, { status: 500 });
  }
}
