"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";
import { InputFecha } from "@/components/ui/InputFecha";
import type { Reunion } from "./types";
import { formatearFechaUTC } from "@/lib/utils/fecha";

const TZ = "America/Argentina/Buenos_Aires";

function formatFechaRegistro(iso: string | Date): string {
  return new Date(iso).toLocaleDateString("es-AR", {
    timeZone: TZ,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function todayArgentina(): string {
  return new Date().toLocaleDateString("es-AR", {
    timeZone: TZ,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

type ModalReunionProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reunion: Reunion | null;
  onSuccess: () => void;
  showMessage: (type: "ok" | "error", text: string) => void;
};

export function ModalReunion({
  open,
  onOpenChange,
  reunion,
  onSuccess,
  showMessage,
}: ModalReunionProps) {
  const isEdit = !!reunion;
  const [organismo, setOrganismo] = useState("");
  const [fechaReunion, setFechaReunion] = useState("");
  const [hora, setHora] = useState("");
  const [observacion, setObservacion] = useState("");
  const [contactoNombre, setContactoNombre] = useState("");
  const [contactoApellido, setContactoApellido] = useState("");
  const [contactoCargo, setContactoCargo] = useState("");
  const [contactoTelefono, setContactoTelefono] = useState("");
  const [contactoMail, setContactoMail] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (reunion) {
      setOrganismo(reunion.organismo);
      setFechaReunion(formatearFechaUTC(new Date(reunion.fechaReunion)));
      setHora(reunion.hora ?? "");
      setObservacion(reunion.observacion ?? "");
      setContactoNombre(reunion.contactoNombre ?? "");
      setContactoApellido(reunion.contactoApellido ?? "");
      setContactoCargo(reunion.contactoCargo ?? "");
      setContactoTelefono(reunion.contactoTelefono ?? "");
      setContactoMail(reunion.contactoMail ?? "");
    } else {
      setOrganismo("");
      setFechaReunion("");
      setHora("");
      setObservacion("");
      setContactoNombre("");
      setContactoApellido("");
      setContactoCargo("");
      setContactoTelefono("");
      setContactoMail("");
    }
  }, [reunion, open]);

  const handleOpenChange = (next: boolean) => {
    if (!next) onOpenChange(false);
    else onOpenChange(true);
  };

  const save = async () => {
    if (!organismo.trim()) {
      showMessage("error", "Organismo / Institución es obligatorio.");
      return;
    }
    const [d, m, y] = fechaReunion.split("/").map((x) => parseInt(x, 10));
    if (!fechaReunion || !d || !m || !y) {
      showMessage("error", "Fecha de la reunión es obligatoria (DD/MM/YYYY).");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        organismo: organismo.trim(),
        fechaReunion: fechaReunion.trim(),
        hora: hora.trim() || null,
        observacion: observacion.trim() || null,
        contactoNombre: contactoNombre.trim() || null,
        contactoApellido: contactoApellido.trim() || null,
        contactoCargo: contactoCargo.trim() || null,
        contactoTelefono: contactoTelefono.trim() || null,
        contactoMail: contactoMail.trim() || null,
      };

      const url = isEdit ? `/api/secretaria/agenda/${reunion!.id}` : "/api/secretaria/agenda";
      const method = isEdit ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        showMessage("error", data.error || "Error al guardar");
        return;
      }
      showMessage("ok", isEdit ? "Reunión actualizada." : "Reunión creada.");
      handleOpenChange(false);
      onSuccess();
    } finally {
      setSaving(false);
    }
  };

  const fechaRegistroTexto = isEdit
    ? formatFechaRegistro(reunion!.fechaCarga)
    : todayArgentina();

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[88vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar Reunión" : "Nueva Reunión"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2 flex-1 overflow-auto pr-1">
          <p className="text-sm text-gray-500">
            Fecha de registro: {fechaRegistroTexto}
          </p>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Organismo / Institución *
            </label>
            <input
              type="text"
              value={organismo}
              onChange={(e) => setOrganismo(e.target.value)}
              className="w-full h-9 rounded-md border border-gray-300 px-3 text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Fecha de la reunión * (DD/MM/YYYY)
              </label>
              <InputFecha
                value={fechaReunion}
                onChange={setFechaReunion}
                placeholder="DD/MM/YYYY"
                className="w-full h-9 rounded-md border border-gray-300 px-3 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Hora (opcional)</label>
              <input
                type="time"
                value={hora}
                onChange={(e) => setHora(e.target.value)}
                className="w-full h-9 rounded-md border border-gray-300 px-3 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Observación (opcional)</label>
            <textarea
              value={observacion}
              onChange={(e) => setObservacion(e.target.value)}
              rows={3}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </div>

          <div className="border-t pt-4 mt-4">
            <h4 className="text-sm font-medium text-gray-700 mb-3">Contacto</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-600 mb-1">Nombre</label>
                <input
                  type="text"
                  value={contactoNombre}
                  onChange={(e) => setContactoNombre(e.target.value)}
                  className="w-full h-9 rounded-md border border-gray-300 px-3 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Apellido</label>
                <input
                  type="text"
                  value={contactoApellido}
                  onChange={(e) => setContactoApellido(e.target.value)}
                  className="w-full h-9 rounded-md border border-gray-300 px-3 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Cargo</label>
                <input
                  type="text"
                  value={contactoCargo}
                  onChange={(e) => setContactoCargo(e.target.value)}
                  className="w-full h-9 rounded-md border border-gray-300 px-3 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Teléfono</label>
                <input
                  type="text"
                  value={contactoTelefono}
                  onChange={(e) => setContactoTelefono(e.target.value)}
                  className="w-full h-9 rounded-md border border-gray-300 px-3 text-sm"
                />
              </div>
            </div>
            <div className="mt-3">
              <label className="block text-sm text-gray-600 mb-1">Mail</label>
              <input
                type="email"
                value={contactoMail}
                onChange={(e) => setContactoMail(e.target.value)}
                className="w-full h-9 rounded-md border border-gray-300 px-3 text-sm"
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancelar
          </Button>
          <Button className="bg-[#4CAF50] hover:bg-[#388E3C]" onClick={save} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Guardar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
