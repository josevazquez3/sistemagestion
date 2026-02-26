"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { UserPlus, Loader2 } from "lucide-react";

type User = { id: string; nombre: string; email: string; roles: string[]; activo: boolean };
type Role = { id: string; nombre: string };
type PermissionsByModule = Record<string, { id: string; accion: string }[]>;

export default function UsuariosPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissionsByModule, setPermissionsByModule] = useState<PermissionsByModule>({});
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [editRoleIds, setEditRoleIds] = useState<string[]>([]);
  const [editPermissionIds, setEditPermissionIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createForm, setCreateForm] = useState({
    nombre: "",
    apellido: "",
    email: "",
    password: "",
    roleIds: [] as string[],
    permissionIds: [] as string[],
  });
  const [creating, setCreating] = useState(false);

  const fetchUsers = async () => {
    try {
      const r = await fetch("/api/usuarios");
      if (!r.ok) throw new Error("Error");
      const data = await r.json();
      setUsers(data);
    } catch {
      setUsers([]);
    }
  };

  const fetchRolesAndPermissions = async () => {
    try {
      const r = await fetch("/api/roles");
      if (!r.ok) throw new Error("Error");
      const data = await r.json();
      setRoles(data.roles ?? []);
      setPermissionsByModule(data.permissionsByModule ?? {});
    } catch {
      setRoles([]);
      setPermissionsByModule({});
    }
  };

  useEffect(() => {
    Promise.all([fetchUsers(), fetchRolesAndPermissions()]).finally(() => setLoading(false));
  }, []);

  const openEditSheet = async (user: User) => {
    setSelectedUser(user);
    setEditRoleIds([]);
    setEditPermissionIds([]);
    try {
      const r = await fetch(`/api/usuarios/${user.id}`);
      if (!r.ok) throw new Error("Error");
      const data = await r.json();
      setEditRoleIds(data.roleIds ?? []);
      setEditPermissionIds(data.permissionIds ?? []);
    } catch {
      // ignore
    }
  };

  const toggleRole = (roleId: string) => {
    setEditRoleIds((prev) =>
      prev.includes(roleId) ? prev.filter((id) => id !== roleId) : [...prev, roleId]
    );
  };

  const togglePermission = (permissionId: string) => {
    setEditPermissionIds((prev) =>
      prev.includes(permissionId) ? prev.filter((id) => id !== permissionId) : [...prev, permissionId]
    );
  };

  const saveChanges = async () => {
    if (!selectedUser) return;
    setSaving(true);
    try {
      const r = await fetch(`/api/usuarios/${selectedUser.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roleIds: editRoleIds, permissionIds: editPermissionIds }),
      });
      if (!r.ok) throw new Error("Error");
      await fetchUsers();
      setSelectedUser(null);
    } catch {
      alert("Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  const desactivarUsuario = async () => {
    if (!selectedUser) return;
    if (!confirm("¿Desactivar este usuario? No podrá iniciar sesión.")) return;
    setSaving(true);
    try {
      const r = await fetch(`/api/usuarios/${selectedUser.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activo: false }),
      });
      if (!r.ok) throw new Error("Error");
      await fetchUsers();
      setSelectedUser(null);
    } catch {
      alert("Error al desactivar");
    } finally {
      setSaving(false);
    }
  };

  const createUser = async () => {
    if (!createForm.nombre || !createForm.apellido || !createForm.email || !createForm.password) {
      alert("Completá todos los campos obligatorios.");
      return;
    }
    setCreating(true);
    try {
      const r = await fetch("/api/usuarios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...createForm,
          roleIds: createForm.roleIds,
          permissionIds: createForm.permissionIds,
        }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? "Error");
      await fetchUsers();
      setShowCreateForm(false);
      setCreateForm({ nombre: "", apellido: "", email: "", password: "", roleIds: [], permissionIds: [] });
    } catch (e: unknown) {
      alert((e as Error).message ?? "Error al crear usuario");
    } finally {
      setCreating(false);
    }
  };

  const toggleCreateRole = (roleId: string) => {
    setCreateForm((f) => ({
      ...f,
      roleIds: f.roleIds.includes(roleId) ? f.roleIds.filter((id) => id !== roleId) : [...f.roleIds, roleId],
    }));
  };

  const toggleCreatePermission = (permissionId: string) => {
    setCreateForm((f) => ({
      ...f,
      permissionIds: f.permissionIds.includes(permissionId)
        ? f.permissionIds.filter((id) => id !== permissionId)
        : [...f.permissionIds, permissionId],
    }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-[#4CAF50]" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-800">Gestión de Usuarios</h1>
          <p className="text-gray-500 mt-1">Administrar usuarios, roles y permisos</p>
        </div>
        <Button
          onClick={() => setShowCreateForm(true)}
          className="bg-[#4CAF50] hover:bg-[#388E3C] text-white"
        >
          <UserPlus className="h-4 w-4 mr-2" />
          Nuevo usuario
        </Button>
      </div>

      <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b bg-gray-50">
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nombre</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Roles</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estado</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr
                key={user.id}
                onClick={() => openEditSheet(user)}
                className="border-b hover:bg-[#E8F5E9] cursor-pointer transition-colors"
              >
                <td className="px-6 py-4 text-sm font-medium text-gray-900">{user.nombre}</td>
                <td className="px-6 py-4 text-sm text-gray-600">{user.email}</td>
                <td className="px-6 py-4 text-sm text-gray-600">{user.roles.join(", ") || "—"}</td>
                <td className="px-6 py-4">
                  <span
                    className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                      user.activo ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {user.activo ? "Activo" : "Inactivo"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {users.length === 0 && (
          <div className="py-12 text-center text-gray-500">No hay usuarios registrados.</div>
        )}
      </div>

      {/* Sheet editar usuario */}
      <Sheet open={!!selectedUser} onOpenChange={(open) => !open && setSelectedUser(null)}>
        <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Editar usuario</SheetTitle>
            <SheetDescription>
              {selectedUser?.nombre} — {selectedUser?.email}
            </SheetDescription>
          </SheetHeader>
          <div className="space-y-6 py-6">
            <div className="space-y-2">
              <Label>Roles</Label>
              <div className="flex flex-wrap gap-3">
                {roles.map((r) => (
                  <label key={r.id} className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={editRoleIds.includes(r.id)}
                      onCheckedChange={() => toggleRole(r.id)}
                    />
                    <span className="text-sm">{r.nombre}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="space-y-3">
              <Label>Permisos por módulo</Label>
              {Object.entries(permissionsByModule).map(([modulo, perms]) => (
                <div key={modulo} className="rounded-lg border p-3 space-y-2">
                  <span className="text-sm font-medium text-gray-700">{modulo}</span>
                  <div className="flex flex-wrap gap-4">
                    {perms.map((p) => (
                      <label key={p.id} className="flex items-center gap-2 cursor-pointer">
                        <Checkbox
                          checked={editPermissionIds.includes(p.id)}
                          onCheckedChange={() => togglePermission(p.id)}
                        />
                        <span className="text-sm">{p.accion}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <SheetFooter className="flex-col sm:flex-row gap-2">
            <Button
              onClick={saveChanges}
              disabled={saving}
              className="w-full sm:w-auto bg-[#4CAF50] hover:bg-[#388E3C] text-white"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Guardar cambios"}
            </Button>
            <Button
              variant="destructive"
              onClick={desactivarUsuario}
              disabled={saving || !selectedUser?.activo}
              className="w-full sm:w-auto"
            >
              Desactivar usuario
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Modal crear usuario - centro de la página */}
      <Dialog
        open={showCreateForm}
        onOpenChange={(open) => {
          setShowCreateForm(open);
          if (!open) setCreateForm({ nombre: "", apellido: "", email: "", password: "", roleIds: [], permissionIds: [] });
        }}
      >
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Nuevo usuario</DialogTitle>
            <DialogDescription>Completá los datos del usuario</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4 overflow-y-auto flex-1 min-h-0">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="nombre">Nombre</Label>
                <Input
                  id="nombre"
                  value={createForm.nombre}
                  onChange={(e) => setCreateForm((f) => ({ ...f, nombre: e.target.value }))}
                  placeholder="Juan"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="apellido">Apellido</Label>
                <Input
                  id="apellido"
                  value={createForm.apellido}
                  onChange={(e) => setCreateForm((f) => ({ ...f, apellido: e.target.value }))}
                  placeholder="Pérez"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={createForm.email}
                onChange={(e) => setCreateForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="juan@ejemplo.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Contraseña</Label>
              <Input
                id="password"
                type="password"
                value={createForm.password}
                onChange={(e) => setCreateForm((f) => ({ ...f, password: e.target.value }))}
                placeholder="Mínimo 6 caracteres"
              />
            </div>
            <div className="space-y-2">
              <Label>Roles</Label>
              <div className="flex flex-wrap gap-3">
                {roles.map((r) => (
                  <label key={r.id} className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={createForm.roleIds.includes(r.id)}
                      onCheckedChange={() => toggleCreateRole(r.id)}
                    />
                    <span className="text-sm">{r.nombre}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="space-y-3">
              <Label>Permisos adicionales</Label>
              {Object.entries(permissionsByModule).map(([modulo, perms]) => (
                <div key={modulo} className="rounded-lg border p-3 space-y-2">
                  <span className="text-sm font-medium text-gray-700">{modulo}</span>
                  <div className="flex flex-wrap gap-4">
                    {perms.map((p) => (
                      <label key={p.id} className="flex items-center gap-2 cursor-pointer">
                        <Checkbox
                          checked={createForm.permissionIds.includes(p.id)}
                          onCheckedChange={() => toggleCreatePermission(p.id)}
                        />
                        <span className="text-sm">{p.accion}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <DialogFooter className="pt-4 border-t">
            <Button
              onClick={createUser}
              disabled={creating}
              className="w-full sm:w-auto bg-[#4CAF50] hover:bg-[#388E3C] text-white"
            >
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Crear usuario"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
