# Guía: Deploy en Vercel

## Si ves 404 DEPLOYMENT_NOT_FOUND

Significa que la URL que usás apunta a un deployment que ya no existe. Solución:

### 1. Usar la URL correcta

**No uses** URLs como:
- `sistemagestion-cqOluedgx-josevazquez3s-projects.vercel.app` (URL de un deployment puntual que puede expirar)

**Usá** la URL de producción principal:
- `https://sistemagestion.vercel.app` 
- O: `https://sistemagestion-[tu-usuario].vercel.app`

Para encontrarla: Vercel → Tu proyecto → pestaña **Deployments** → el deployment con estado "Ready" → dominio principal (no el de preview).

### 2. Variables de entorno obligatorias

En **Settings → Environment Variables** debe haber:

| Variable | Para Production |
|----------|-----------------|
| `DATABASE_URL` | Tu connection string de Neon |
| `AUTH_SECRET` | `openssl rand -base64 32` |
| `NEXTAUTH_URL` | `https://sistemagestion.vercel.app` (o tu URL real) |

### 3. Nuevo deploy

1. Hacé un push a `main`
2. O en Vercel: Deployments → los 3 puntos del último deploy → **Redeploy**
3. Esperá a que el build termine (estado "Ready")
4. Hacé clic en **Visit** para abrir la URL correcta

### 4. Si sigue fallando

- Borrá la caché de cookies del navegador para el dominio de Vercel
- Probá en una ventana de incógnito
- Verificá que el deployment esté "Ready" (verde), no "Error" o "Canceled"
