"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FormularioLicencia } from "@/components/licencias/FormularioLicencia";
import { HistorialLicencias } from "@/components/licencias/HistorialLicencias";
import { HistorialCertificados } from "@/components/licencias/HistorialCertificados";
import { NominaLicencias } from "@/components/licencias/NominaLicencias";
import { PlusCircle, History, FileCheck, ListChecks } from "lucide-react";

type Tab = "nueva" | "historial" | "certificados" | "nomina";

export default function LicenciasPage() {
  const { data: session } = useSession();
  const roles = (session?.user as { roles?: string[] })?.roles ?? [];
  const puedeGestionar = roles.includes("ADMIN") || roles.includes("RRHH");

  const [tab, setTab] = useState<Tab>("nueva");
  const [refreshHistorial, setRefreshHistorial] = useState(0);
  const [editarLicenciaId, setEditarLicenciaId] = useState<number | null>(null);
  const [exitoMessage, setExitoMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!exitoMessage) return;
    const t = setTimeout(() => setExitoMessage(null), 4000);
    return () => clearTimeout(t);
  }, [exitoMessage]);

  if (!puedeGestionar) {
    return (
      <div className="max-w-2xl">
        <h1 className="text-2xl font-semibold text-gray-800">Licencias</h1>
        <p className="text-gray-500 mt-2">No tenés permisos para gestionar licencias.</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-5xl overflow-hidden space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-800">Licencias</h1>
        <p className="text-gray-500 mt-1">
          Gestión de licencias (ART, enfermedad, estudio, maternidad, paternidad).
        </p>
      </div>

      {exitoMessage && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          {exitoMessage}
        </div>
      )}

      <div className="flex flex-wrap gap-2 border-b border-gray-200 pb-2">
        <Button
          variant={tab === "nueva" ? "default" : "outline"}
          size="sm"
          onClick={() => setTab("nueva")}
          className={tab === "nueva" ? "bg-[#4CAF50] hover:bg-[#388E3C]" : ""}
        >
          <PlusCircle className="h-4 w-4 mr-1" />
          Nueva licencia
        </Button>
        <Button
          variant={tab === "historial" ? "default" : "outline"}
          size="sm"
          onClick={() => setTab("historial")}
          className={tab === "historial" ? "bg-[#4CAF50] hover:bg-[#388E3C]" : ""}
        >
          <History className="h-4 w-4 mr-1" />
          Historial por legajo
        </Button>
        <Button
          variant={tab === "certificados" ? "default" : "outline"}
          size="sm"
          onClick={() => setTab("certificados")}
          className={tab === "certificados" ? "bg-[#4CAF50] hover:bg-[#388E3C]" : ""}
        >
          <FileCheck className="h-4 w-4 mr-1" />
          Historial de certificados
        </Button>
        <Button
          variant={tab === "nomina" ? "default" : "outline"}
          size="sm"
          onClick={() => setTab("nomina")}
          className={tab === "nomina" ? "bg-[#4CAF50] hover:bg-[#388E3C]" : ""}
        >
          <ListChecks className="h-4 w-4 mr-1" />
          Nómina de Licencias
        </Button>
      </div>

      {tab === "nueva" && (
        <Card className="rounded-xl border shadow-sm">
          <CardHeader>
            <CardTitle>{editarLicenciaId ? "Editar licencia" : "Alta de licencia"}</CardTitle>
            <p className="text-sm text-gray-500">
              {editarLicenciaId
                ? "Modificá la fecha de finalización, observaciones o certificados."
                : "Seleccioná el legajo, marcá los días en el calendario y completá los datos."}
            </p>
          </CardHeader>
          <CardContent>
            <FormularioLicencia
              licenciaIdEditar={editarLicenciaId}
              onSuccess={(message) => {
                setRefreshHistorial((r) => r + 1);
                if (message) setExitoMessage(message);
                setEditarLicenciaId(null);
                setTab("historial");
              }}
              onCancel={() => {
                setEditarLicenciaId(null);
                setTab("historial");
              }}
            />
          </CardContent>
        </Card>
      )}

      {tab === "historial" && (
        <Card className="rounded-xl border shadow-sm">
          <CardHeader>
            <CardTitle>Historial de licencias por empleado</CardTitle>
            <p className="text-sm text-gray-500">
              Buscá un legajo para ver sus licencias y finalizar las activas.
            </p>
          </CardHeader>
          <CardContent>
            <HistorialLicencias
              key={refreshHistorial}
              onEditar={(id) => {
                setEditarLicenciaId(id);
                setTab("nueva");
              }}
            />
          </CardContent>
        </Card>
      )}

      {tab === "certificados" && (
        <Card className="rounded-xl border shadow-sm">
          <CardHeader>
            <CardTitle>Historial de certificados</CardTitle>
            <p className="text-sm text-gray-500">
              Todos los certificados cargados (inicio y cierre), ordenados por fecha.
            </p>
          </CardHeader>
          <CardContent>
            <HistorialCertificados />
          </CardContent>
        </Card>
      )}

      {tab === "nomina" && (
        <Card className="w-full overflow-hidden rounded-xl border shadow-sm">
          <CardHeader>
            <CardTitle>Nómina de Licencias</CardTitle>
            <p className="text-sm text-gray-500">
              Empleados con licencia activa. Podés agregar o editar observaciones y exportar a PDF o DOCX.
            </p>
          </CardHeader>
          <CardContent>
            <NominaLicencias />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
