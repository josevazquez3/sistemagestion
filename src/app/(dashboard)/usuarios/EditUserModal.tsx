"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type UserLite = {
  id: string;
  nombre: string;
  email: string;
};

type Props = {
  open: boolean;
  user: UserLite | null;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
  showToast: (message: string, type: "success" | "error") => void;
};

export function EditUserModal({ open, user, onOpenChange, onSaved, showToast }: Props) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !user) return;
    setEmail(user.email ?? "");
    setPassword("");
    setConfirmPassword("");
  }, [open, user]);

  const handleSave = async () => {
    if (!user) return;

    const nextEmail = email.trim().toLowerCase();
    const nextPassword = password.trim();

    if (!nextEmail) {
      showToast("El email es obligatorio.", "error");
      return;
    }

    if (nextPassword && nextPassword.length < 6) {
      showToast("La contraseña debe tener al menos 6 caracteres.", "error");
      return;
    }

    if (nextPassword && nextPassword !== confirmPassword) {
      showToast("Las contraseñas no coinciden.", "error");
      return;
    }

    setSaving(true);
    try {
      const payload: { email: string; password?: string } = { email: nextEmail };
      if (nextPassword) payload.password = nextPassword;

      const response = await fetch(`/api/admin/usuarios/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(json.error ?? "No se pudo actualizar el usuario.");
      }

      showToast("Usuario actualizado correctamente.", "success");
      onSaved();
      onOpenChange(false);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Error al actualizar.", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Editar email y contraseña</DialogTitle>
          <DialogDescription>
            {user?.nombre} {user ? `— ${user.email}` : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="edit-email">Email</Label>
            <Input
              id="edit-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="usuario@dominio.com"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-password">Nueva contraseña (opcional)</Label>
            <Input
              id="edit-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mínimo 6 caracteres"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-password-confirm">Confirmar contraseña</Label>
            <Input
              id="edit-password-confirm"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Repetir contraseña"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving} className="bg-[#4CAF50] hover:bg-[#388E3C] text-white">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Guardar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
