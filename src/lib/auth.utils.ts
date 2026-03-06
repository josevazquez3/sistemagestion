/**
 * Helpers de autorización por roles.
 * SUPER_ADMIN hereda todas las capacidades de ADMIN más eliminación física.
 * Acepta roles como array de strings o de objetos { nombre?, name? } por compatibilidad.
 */

function normalizeRole(r: unknown): string | null {
  if (typeof r === "string") return r;
  if (r && typeof r === "object" && "nombre" in r && typeof (r as { nombre: unknown }).nombre === "string")
    return (r as { nombre: string }).nombre;
  if (r && typeof r === "object" && "name" in r && typeof (r as { name: unknown }).name === "string")
    return (r as { name: string }).name;
  return null;
}

/** Verificación robusta: acepta roles como string[] o como array de objetos con nombre/name */
export function isSuperAdmin(roles: unknown): boolean {
  const list = Array.isArray(roles) ? roles : [];
  return list.some(
    (r) => normalizeRole(r) === "SUPER_ADMIN"
  );
}

/** True si es ADMIN o RRHH (gestión legajos, vacaciones, etc.) */
export function canManageLegajos(roles: unknown): boolean {
  const list = Array.isArray(roles) ? roles : [];
  const names = list.map(normalizeRole).filter(Boolean) as string[];
  return names.includes("ADMIN") || names.includes("RRHH") || names.includes("SUPER_ADMIN");
}

/** True si puede acceder a funciones de administrador (incluye SUPER_ADMIN) */
export function isAdminOrSuper(roles: unknown): boolean {
  const list = Array.isArray(roles) ? roles : [];
  const names = list.map(normalizeRole).filter(Boolean) as string[];
  return names.includes("ADMIN") || names.includes("RRHH") || names.includes("SUPER_ADMIN");
}
