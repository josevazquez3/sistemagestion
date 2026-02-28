"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Loader2, Plus, Trash2, User } from "lucide-react";

const PARENTESCO_OPTIONS = [
  { value: "CONYUGE", label: "Cónyuge" },
  { value: "HIJO", label: "Hijo/a" },
  { value: "PADRE", label: "Padre" },
  { value: "MADRE", label: "Madre" },
  { value: "HERMANO", label: "Hermano/a" },
  { value: "OTRO", label: "Otro" },
];

type Contacto = {
  nombres: string;
  apellidos: string;
  parentesco: string;
  calle?: string;
  numero?: string;
  casa?: string;
  departamento?: string;
  piso?: string;
  telefonos: string[];
};

const emptyContacto = (): Contacto => ({
  nombres: "",
  apellidos: "",
  parentesco: "OTRO",
  calle: "",
  numero: "",
  casa: "",
  departamento: "",
  piso: "",
  telefonos: [""],
});

function maskCUIL(value: string) {
  const v = value.replace(/\D/g, "").slice(0, 11);
  if (v.length <= 2) return v;
  if (v.length <= 10) return `${v.slice(0, 2)}-${v.slice(2)}`;
  return `${v.slice(0, 2)}-${v.slice(2, 10)}-${v.slice(10)}`;
}

/** Devuelve solo la parte del número sin el prefijo +54 para mostrar en el input. */
function celularSinPrefijo(valorGuardado: string | null | undefined): string {
  const v = (valorGuardado ?? "").trim();
  if (!v) return "";
  return v.startsWith("+54") ? v.slice(3).trim() : v;
}

export function LegajoForm({
  open,
  onOpenChange,
  editingId,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingId: string | null;
  onSuccess: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [showContactos, setShowContactos] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    numeroLegajo: "",
    nombres: "",
    apellidos: "",
    dni: "",
    cuil: "",
    fotoUrl: "",
    calle: "",
    numero: "",
    casa: "",
    departamento: "",
    piso: "",
    localidad: "",
    codigoPostal: "",
    fechaAlta: "",
    fechaBaja: "",
    celular: "",
    contactos: [] as Contacto[],
  });

  useEffect(() => {
    if (open && editingId) {
      fetch(`/api/legajos/${editingId}`)
        .then((r) => r.json())
        .then((data) => {
          setForm({
            numeroLegajo: String(data.numeroLegajo ?? ""),
            nombres: data.nombres ?? "",
            apellidos: data.apellidos ?? "",
            dni: data.dni ?? "",
            cuil: data.cuil ?? "",
            fotoUrl: data.fotoUrl ?? "",
            calle: data.calle ?? "",
            numero: String(data.numero ?? ""),
            casa: data.casa ?? "",
            departamento: data.departamento ?? "",
            piso: data.piso ?? "",
            localidad: data.localidad ?? "",
            codigoPostal: data.codigoPostal ?? "",
            fechaAlta: data.fechaAlta ? new Date(data.fechaAlta).toISOString().split("T")[0] : "",
            fechaBaja: data.fechaBaja ? new Date(data.fechaBaja).toISOString().split("T")[0] : "",
            celular: celularSinPrefijo(data.celular),
            contactos: (data.contactos ?? []).map((c: { nombres: string; apellidos: string; parentesco: string; calle?: string; numero?: string; casa?: string; departamento?: string; piso?: string; telefonos: { numero: string }[] }) => ({
              nombres: c.nombres,
              apellidos: c.apellidos,
              parentesco: c.parentesco,
              calle: c.calle ?? "",
              numero: c.numero ?? "",
              casa: c.casa ?? "",
              departamento: c.departamento ?? "",
              piso: c.piso ?? "",
              telefonos: c.telefonos?.map((t) => t.numero) ?? [""],
            })),
          });
          setShowContactos((data.contactos ?? []).length > 0);
        })
        .catch(() => {});
    }
    if (open && !editingId) {
      setForm({
        numeroLegajo: "",
        nombres: "",
        apellidos: "",
        dni: "",
        cuil: "",
        fotoUrl: "",
        calle: "",
        numero: "",
        casa: "",
        departamento: "",
        piso: "",
        localidad: "",
        codigoPostal: "",
        fechaAlta: "",
        fechaBaja: "",
        celular: "",
        contactos: [],
      });
      setShowContactos(false);
    }
  }, [open, editingId]);

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => setForm((f) => ({ ...f, fotoUrl: reader.result as string }));
    reader.readAsDataURL(file);
  };

  const addContacto = () => setForm((f) => ({ ...f, contactos: [...f.contactos, emptyContacto()] }));
  const removeContacto = (i: number) => setForm((f) => ({ ...f, contactos: f.contactos.filter((_, j) => j !== i) }));
  const updateContacto = (i: number, upd: Partial<Contacto>) => {
    setForm((f) => ({
      ...f,
      contactos: f.contactos.map((c, j) => (j === i ? { ...c, ...upd } : c)),
    }));
  };
  const addTelefono = (ci: number) => {
    setForm((f) => ({
      ...f,
      contactos: f.contactos.map((c, j) => (j === ci ? { ...c, telefonos: [...c.telefonos, ""] } : c)),
    }));
  };
  const removeTelefono = (ci: number, ti: number) => {
    setForm((f) => ({
      ...f,
      contactos: f.contactos.map((c, j) =>
        j === ci ? { ...c, telefonos: c.telefonos.filter((_, k) => k !== ti) } : c
      ),
    }));
  };
  const updateTelefono = (ci: number, ti: number, val: string) => {
    setForm((f) => ({
      ...f,
      contactos: f.contactos.map((c, j) =>
        j === ci ? { ...c, telefonos: c.telefonos.map((t, k) => (k === ti ? val : t)) } : c
      ),
    }));
  };

  const submit = async () => {
    if (!form.nombres || !form.apellidos || !form.dni || !form.calle || !form.numero || !form.localidad || !form.codigoPostal || !form.fechaAlta) {
      alert("Completá los campos obligatorios.");
      return;
    }
    const numLegajo = parseInt(form.numeroLegajo, 10);
    if (isNaN(numLegajo)) {
      alert("Número de legajo inválido.");
      return;
    }
    const dniVal = form.dni.replace(/\D/g, "");
    if (dniVal.length < 7 || dniVal.length > 8) {
      alert("DNI debe tener 7 u 8 dígitos.");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        numeroLegajo: numLegajo,
        nombres: form.nombres,
        apellidos: form.apellidos,
        dni: dniVal,
        cuil: form.cuil.replace(/\D/g, "").length >= 11 ? form.cuil : null,
        fotoUrl: form.fotoUrl || null,
        calle: form.calle,
        numero: parseInt(form.numero, 10),
        casa: form.casa || null,
        departamento: form.departamento || null,
        piso: form.piso || null,
        localidad: form.localidad,
        codigoPostal: form.codigoPostal,
        fechaAlta: form.fechaAlta,
        celular: form.celular.trim() ? "+54 " + form.celular.trim() : null,
        contactos: showContactos
          ? form.contactos
              .filter((c) => c.nombres || c.apellidos)
              .map((c) => ({
                ...c,
                telefonos: c.telefonos.filter((t) => t.trim()),
              }))
          : [],
      };

      if (editingId) {
        const r = await fetch(`/api/legajos/${editingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await r.json();
        if (!r.ok) throw new Error(data.error ?? "Error");
      } else {
        const r = await fetch("/api/legajos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await r.json();
        if (!r.ok) throw new Error(data.error ?? "Error");
      }
      onSuccess();
    } catch (e: unknown) {
      alert((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{editingId ? "Editar legajo" : "Nuevo legajo"}</DialogTitle>
          <DialogDescription>Completá los datos del empleado</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4 overflow-y-auto flex-1 min-h-0">
          {/* Foto */}
          <div className="flex items-center gap-4">
            <div
              onClick={() => fileInputRef.current?.click()}
              className="h-24 w-24 rounded-full bg-[#C8E6C9] flex items-center justify-center overflow-hidden cursor-pointer hover:opacity-80 border-2 border-dashed border-[#4CAF50]"
            >
              {form.fotoUrl ? (
                <img src={form.fotoUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <User className="h-10 w-10 text-[#388E3C]" />
              )}
            </div>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
            <span className="text-sm text-gray-500">Clic para subir foto</span>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Nº Legajo *</Label>
              <Input
                type="number"
                value={form.numeroLegajo}
                onChange={(e) => setForm((f) => ({ ...f, numeroLegajo: e.target.value }))}
                placeholder="Ej: 1001"
              />
            </div>
            <div className="space-y-2">
              <Label>DNI (7-8 dígitos) *</Label>
              <Input
                value={form.dni}
                onChange={(e) => setForm((f) => ({ ...f, dni: e.target.value.replace(/\D/g, "").slice(0, 8) }))}
                placeholder="Ej: 30123456"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Nombres *</Label>
              <Input value={form.nombres} onChange={(e) => setForm((f) => ({ ...f, nombres: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Apellidos *</Label>
              <Input value={form.apellidos} onChange={(e) => setForm((f) => ({ ...f, apellidos: e.target.value }))} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>CUIL (XX-XXXXXXXX-X)</Label>
              <Input
                value={form.cuil}
                onChange={(e) => setForm((f) => ({ ...f, cuil: maskCUIL(e.target.value) }))}
                placeholder="20-30123456-7"
              />
            </div>
            <div className="space-y-2">
              <Label>Celular</Label>
              <div className="flex items-center rounded-md border border-input overflow-hidden focus-within:ring-2 focus-within:ring-[#4CAF50] focus-within:ring-offset-0">
                <span className="px-3 py-2 bg-gray-100 text-gray-600 border-r border-input select-none text-sm font-medium">
                  +54
                </span>
                <input
                  type="tel"
                  value={form.celular}
                  onChange={(e) => {
                    const soloNumeros = e.target.value.replace(/[^\d\s\-]/g, "");
                    setForm((f) => ({ ...f, celular: soloNumeros.slice(0, 15) }));
                  }}
                  placeholder="11 1234-5678"
                  className="flex-1 min-w-0 px-3 py-2 outline-none text-sm rounded-none border-0 h-9"
                  maxLength={15}
                />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Dirección *</Label>
            <div className="grid grid-cols-6 gap-2">
              <Input className="col-span-2" value={form.calle} onChange={(e) => setForm((f) => ({ ...f, calle: e.target.value }))} placeholder="Calle" />
              <Input type="number" value={form.numero} onChange={(e) => setForm((f) => ({ ...f, numero: e.target.value }))} placeholder="Nº" />
              <Input value={form.casa} onChange={(e) => setForm((f) => ({ ...f, casa: e.target.value }))} placeholder="Casa" />
              <Input value={form.departamento} onChange={(e) => setForm((f) => ({ ...f, departamento: e.target.value }))} placeholder="Dpto" />
              <Input value={form.piso} onChange={(e) => setForm((f) => ({ ...f, piso: e.target.value }))} placeholder="Piso" />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Localidad *</Label>
              <Input value={form.localidad} onChange={(e) => setForm((f) => ({ ...f, localidad: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Código Postal *</Label>
              <Input value={form.codigoPostal} onChange={(e) => setForm((f) => ({ ...f, codigoPostal: e.target.value }))} placeholder="Ej: 1234" />
            </div>
            <div className="space-y-2">
              <Label>Fecha de Alta *</Label>
              <Input type="date" value={form.fechaAlta} onChange={(e) => setForm((f) => ({ ...f, fechaAlta: e.target.value }))} />
            </div>
          </div>

          {/* Contactos adicionales - colapsable */}
          <div className="border rounded-lg p-4 space-y-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <Checkbox checked={showContactos} onCheckedChange={(c) => setShowContactos(!!c)} />
              <span>Agregar grupo familiar / contactos adicionales</span>
            </label>
            {showContactos && (
              <div className="space-y-4 pt-2">
                <Button type="button" variant="outline" size="sm" onClick={addContacto} className="bg-[#4CAF50] text-white hover:bg-[#388E3C] border-0">
                  <Plus className="h-4 w-4 mr-2" />
                  Agregar contacto
                </Button>
                {form.contactos.map((c, i) => (
                  <div key={i} className="border rounded p-4 space-y-3 relative">
                    <Button type="button" variant="ghost" size="icon-sm" className="absolute right-2 top-2 text-red-600" onClick={() => removeContacto(i)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                    <div className="grid grid-cols-2 gap-2">
                      <Input placeholder="Nombres" value={c.nombres} onChange={(e) => updateContacto(i, { nombres: e.target.value })} />
                      <Input placeholder="Apellidos" value={c.apellidos} onChange={(e) => updateContacto(i, { apellidos: e.target.value })} />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <select
                        value={c.parentesco}
                        onChange={(e) => updateContacto(i, { parentesco: e.target.value })}
                        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                      >
                        {PARENTESCO_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                    </div>
                    <div className="grid grid-cols-4 gap-2">
                      <Input placeholder="Calle" value={c.calle} onChange={(e) => updateContacto(i, { calle: e.target.value })} />
                      <Input placeholder="Nº" value={c.numero} onChange={(e) => updateContacto(i, { numero: e.target.value })} />
                      <Input placeholder="Casa" value={c.casa} onChange={(e) => updateContacto(i, { casa: e.target.value })} />
                      <Input placeholder="Dpto" value={c.departamento} onChange={(e) => updateContacto(i, { departamento: e.target.value })} />
                      <Input placeholder="Piso" value={c.piso} onChange={(e) => updateContacto(i, { piso: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm">Teléfonos</span>
                        <Button type="button" variant="ghost" size="icon-xs" onClick={() => addTelefono(i)} className="text-[#4CAF50]">
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                      {c.telefonos.map((t, ti) => (
                        <div key={ti} className="flex gap-2">
                          <Input value={t} onChange={(e) => updateTelefono(i, ti, e.target.value)} placeholder="Número" />
                          {c.telefonos.length > 1 && (
                            <Button type="button" variant="ghost" size="icon-sm" onClick={() => removeTelefono(i, ti)} className="text-red-600">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        <DialogFooter className="pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={saving} className="bg-[#4CAF50] hover:bg-[#388E3C] text-white">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Guardar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
