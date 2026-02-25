# Sistema de Gestión Institucional

Sistema de gestión institucional completo construido con Next.js 14+, TypeScript, PostgreSQL (Neon), Prisma y shadcn/ui.

## Stack Tecnológico

- **Framework:** Next.js 16 (App Router)
- **Lenguaje:** TypeScript
- **Base de datos:** PostgreSQL en Neon (serverless)
- **ORM:** Prisma
- **Autenticación:** NextAuth.js v5 (por implementar)
- **Estilos:** Tailwind CSS v4
- **Componentes UI:** shadcn/ui
- **Deploy:** Vercel

## Requisitos Previos

- Node.js 18+
- Cuenta en [Neon](https://neon.tech) para la base de datos PostgreSQL
- npm o pnpm

## Configuración Inicial

1. **Clonar y instalar dependencias:**

   ```bash
   npm install
   ```

2. **Configurar variables de entorno:**

   - Copiar `.env.example` a `.env`
   - Obtener connection string de PostgreSQL desde [Neon Console](https://console.neon.tech)
   - Completar `DATABASE_URL` con tu connection string
   - Generar `NEXTAUTH_SECRET`: `openssl rand -base64 32`

3. **Ejecutar migraciones** (cuando el schema esté definido en el Paso 2):

   ```bash
   npm run db:migrate
   ```

## Scripts Disponibles

| Script         | Descripción                          |
|----------------|--------------------------------------|
| `npm run dev`  | Servidor de desarrollo               |
| `npm run build`| Build de producción                  |
| `npm run start`| Iniciar en producción                |
| `npm run lint` | Ejecutar ESLint                      |
| `npm run db:generate` | Generar cliente Prisma        |
| `npm run db:push`     | Sincronizar schema con DB (dev) |
| `npm run db:migrate`  | Ejecutar migraciones            |

## Estructura del Proyecto

```
src/
├── app/           # App Router (rutas y layouts)
├── components/    # Componentes React
│   ├── ui/        # shadcn/ui
│   ├── layout/    # Sidebar, Header, Breadcrumb
│   ├── legajos/   # Módulo RRHH
│   └── usuarios/  # Gestión de usuarios
├── lib/           # Utilidades y configuración
│   ├── prisma.ts  # Cliente Prisma singleton
│   └── utils.ts   # Utilidades (cn, etc.)
├── prisma/        # Schema y migraciones
└── types/         # Tipos TypeScript
```

## Paleta de Colores

- **Verdes pastel:** #A8D5B5, #C8E6C9, #E8F5E9
- **Blancos:** #FFFFFF, #F9FAFB
- **Acentos primarios:** #4CAF50, #388E3C

## Estado del Proyecto

- [x] **Paso 1:** Setup inicial (Next.js + Tailwind + shadcn + Prisma + Neon)
- [ ] Paso 2: Schema de base de datos y migraciones
- [ ] Paso 3: Sistema de autenticación (NextAuth + login)
- [ ] Paso 4: Layout principal (Sidebar + Header)
- [ ] Pasos posteriores...

## Licencia

Privado - Uso institucional
