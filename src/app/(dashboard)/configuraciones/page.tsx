import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { ConfiguracionesContent } from "./ConfiguracionesContent";

export default async function ConfiguracionesPage() {
  const session = await auth();
  const roles = (session?.user as { roles?: string[] })?.roles ?? [];
  if (!roles.includes("ADMIN")) {
    redirect("/dashboard");
  }

  return <ConfiguracionesContent />;
}
