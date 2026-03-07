import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { canManageLegajos } from "@/lib/auth.utils";
import { subirArchivo } from "@/lib/blob";
import { randomBytes } from "crypto";

const TIPOS_PERMITIDOS = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
const MAX_SIZE = 5 * 1024 * 1024; // 5 MB

export async function POST(req: NextRequest) {
  const session = await auth();
  const roles = (session?.user as { roles?: string[] })?.roles ?? [];
  if (!canManageLegajos(roles)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file || !(file instanceof File) || file.size === 0) {
      return NextResponse.json({ error: "No se recibió archivo" }, { status: 400 });
    }

    const mime = file.type?.toLowerCase() ?? "";
    if (!TIPOS_PERMITIDOS.includes(mime)) {
      return NextResponse.json(
        { error: "Tipo de archivo no permitido. Solo JPG, PNG o WEBP." },
        { status: 400 }
      );
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: "El archivo supera el tamaño máximo de 5 MB." },
        { status: 400 }
      );
    }

    const ext = mime.split("/")[1]?.replace("jpeg", "jpg") ?? "jpg";
    const nombreUnico = `foto_${Date.now()}_${randomBytes(4).toString("hex")}.${ext}`;

    const url = await subirArchivo("legajos", nombreUnico, file, mime);

    return NextResponse.json({ url });
  } catch (error) {
    console.error("Error subiendo foto:", error);
    return NextResponse.json(
      { error: "Error al subir la foto" },
      { status: 500 }
    );
  }
}
