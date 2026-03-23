"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, Upload, Trash2 } from "lucide-react";
import { ModalBackup } from "@/components/configuraciones/ModalBackup";
import { ModalRestore } from "@/components/configuraciones/ModalRestore";
import { ModalVaciarBDD } from "@/components/configuraciones/ModalVaciarBDD";
import { AuditoriaPanel } from "@/components/configuraciones/AuditoriaPanel";

export function ConfiguracionesContent() {
  const [modalBackup, setModalBackup] = useState(false);
  const [modalRestore, setModalRestore] = useState(false);
  const [modalVaciar, setModalVaciar] = useState(false);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Configuraciones</h1>
      </div>

      <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-800 mb-1">
          Gestión de Base de Datos
        </h2>
        <p className="text-sm text-gray-600 mb-6">
          Realizá backups, restaurá datos o limpiá la base de datos.
        </p>

        <div className="flex flex-wrap gap-4">
          <Button
            type="button"
            onClick={() => setModalBackup(true)}
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            <Download className="h-4 w-4 mr-2" />
            Generar Backup
          </Button>
          <Button
            type="button"
            onClick={() => setModalRestore(true)}
            className="bg-orange-500 hover:bg-orange-600 text-white"
          >
            <Upload className="h-4 w-4 mr-2" />
            Incorporar Backup
          </Button>
          <Button
            type="button"
            onClick={() => setModalVaciar(true)}
            variant="destructive"
            className="bg-red-600 hover:bg-red-700 text-white"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Vaciar Base de Datos
          </Button>
        </div>
      </section>

      <ModalBackup open={modalBackup} onOpenChange={setModalBackup} />
      <ModalRestore open={modalRestore} onOpenChange={setModalRestore} />
      <ModalVaciarBDD open={modalVaciar} onOpenChange={setModalVaciar} />

      <AuditoriaPanel />
    </div>
  );
}
