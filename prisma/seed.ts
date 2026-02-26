import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  // Crear roles
  const roles = await Promise.all([
    prisma.role.upsert({
      where: { nombre: "ADMIN" },
      update: {},
      create: { nombre: "ADMIN" },
    }),
    prisma.role.upsert({
      where: { nombre: "SECRETARIA" },
      update: {},
      create: { nombre: "SECRETARIA" },
    }),
    prisma.role.upsert({
      where: { nombre: "TESORERO" },
      update: {},
      create: { nombre: "TESORERO" },
    }),
    prisma.role.upsert({
      where: { nombre: "RRHH" },
      update: {},
      create: { nombre: "RRHH" },
    }),
    prisma.role.upsert({
      where: { nombre: "EMPLEADO" },
      update: {},
      create: { nombre: "EMPLEADO" },
    }),
  ]);

  const adminRole = roles[0];
  const rrhhRole = roles[3];

  // Crear permisos granulares por módulo (VER, CREAR, EDITAR, ELIMINAR)
  const modulos = ["RRHH", "TESORERIA", "SECRETARIA", "LEGALES", "USUARIOS"];
  const acciones = ["VER", "CREAR", "EDITAR", "ELIMINAR"] as const;
  for (const modulo of modulos) {
    for (const accion of acciones) {
      await prisma.permission.upsert({
        where: { modulo_accion: { modulo, accion: accion as "VER" | "CREAR" | "EDITAR" | "ELIMINAR" } },
        update: {},
        create: { modulo, accion },
      });
    }
  }
  console.log("✓ Permisos creados (5 módulos x 4 acciones)");

  // Crear usuario admin si no existe
  const existingAdmin = await prisma.user.findUnique({
    where: { email: "admin@sistema.com" },
  });

  if (!existingAdmin) {
    const passwordHash = await bcrypt.hash("admin123", 10);
    const adminUser = await prisma.user.create({
      data: {
        nombre: "Administrador",
        apellido: "Sistema",
        email: "admin@sistema.com",
        passwordHash,
        activo: true,
      },
    });

    await prisma.userRole.create({
      data: {
        userId: adminUser.id,
        roleId: adminRole.id,
      },
    });

    console.log("✓ Usuario admin creado: admin@sistema.com / admin123");
  } else {
    console.log("Usuario admin ya existe.");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
