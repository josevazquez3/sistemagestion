import { auth } from "@/lib/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, FileText, Building2 } from "lucide-react";

export default async function DashboardPage() {
  const session = await auth();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-800">
          Bienvenido, {session?.user?.name?.split(" ")[0] ?? "Usuario"}
        </h1>
        <p className="text-gray-500 mt-1">
          Sistema de Gestión Institucional
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card className="rounded-xl border shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Recursos Humanos
            </CardTitle>
            <Users className="h-4 w-4 text-[#4CAF50]" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-gray-800">Legajos</p>
            <CardDescription>Gestión de empleados y legajos</CardDescription>
          </CardContent>
        </Card>
        <Card className="rounded-xl border shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Secretaría
            </CardTitle>
            <FileText className="h-4 w-4 text-[#4CAF50]" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-gray-800">Módulo</p>
            <CardDescription>Próximamente</CardDescription>
          </CardContent>
        </Card>
        <Card className="rounded-xl border shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Tesorería
            </CardTitle>
            <Building2 className="h-4 w-4 text-[#4CAF50]" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-gray-800">Módulo</p>
            <CardDescription>Próximamente</CardDescription>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
