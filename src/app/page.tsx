import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

/**
 * Página raíz: redirige al dashboard si está logueado, sino al login.
 */
export default async function HomePage() {
  const session = await auth();

  if (session?.user) {
    redirect("/dashboard");
  }

  redirect("/login");
}
