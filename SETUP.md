# Configuración del Sistema de Gestión

## Pasos para correr localmente

### 1. Variables de entorno (.env)

Actualizá tu archivo `.env` con los valores reales:

```env
# Tu connection string de Neon (reemplazá el placeholder)
DATABASE_URL="postgresql://usuario:password@ep-xxxx.region.aws.neon.tech/neondb?sslmode=require"

# Generar con: openssl rand -base64 32
NEXTAUTH_SECRET="tu-secret-generado"
AUTH_SECRET="tu-secret-generado"
NEXTAUTH_URL="http://localhost:3000"

NEXT_PUBLIC_APP_NAME="Sistema de Gestión"
```

### 2. Crear tablas en la base de datos

```bash
npx prisma migrate dev --name init
```

O si preferís sincronizar sin historial de migraciones:

```bash
npx prisma db push
```

### 3. Crear usuario administrador

```bash
npm run db:seed
```

Esto crea el usuario:
- **Email:** admin@sistema.com
- **Contraseña:** admin123

### 4. Iniciar el servidor

```bash
npm run dev
```

Abrí [http://localhost:3000](http://localhost:3000) — serás redirigido al login.

---

## Para Vercel (deploy)

Configurá estas variables en **Project Settings → Environment Variables**:

| Variable | Valor | Importante |
|----------|-------|------------|
| `DATABASE_URL` | Connection string de Neon | Obligatorio |
| `AUTH_SECRET` | openssl rand -base64 32 | Obligatorio |
| `NEXTAUTH_URL` | **https://tu-dominio.vercel.app** | Crítico: debe ser la URL real de producción |

**Si NEXTAUTH_URL está mal o vacío** → ERR_TOO_MANY_REDIRECTS al abrir el sitio.

**Importante:** Después del primer deploy, ejecutá las migraciones contra la base de datos de producción. Podés usar `npx prisma migrate deploy` desde tu máquina con `DATABASE_URL` apuntando a Neon.

Para el seed en producción, ejecutá localmente con la DATABASE_URL de producción temporalmente, o creá el usuario admin manualmente desde la consola de Prisma.
