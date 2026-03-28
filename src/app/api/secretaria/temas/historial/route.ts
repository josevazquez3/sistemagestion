import { NextResponse } from "next/server";
import { getTemaUsadoListItems } from "@/lib/secretaria/reporteTemasData";
import { canAccess, ensureTemasTables, getSessionUser } from "../_shared";

export async function GET() {
  const user = await getSessionUser();
  if (!user || !canAccess(user.roles ?? [])) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  await ensureTemasTables();

  const items = await getTemaUsadoListItems();
  return NextResponse.json(items);
}
