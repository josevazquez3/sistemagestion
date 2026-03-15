/**
 * Crea un usuario SUPER_ADMIN.
 * Ejecutar: npx tsx scripts/create-super-admin.ts
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const EMAIL = "josevazquez3@gmail.com";
const PASSWORD = "jose123";

async function main() {
  const passwordHash = await bcrypt.hash(PASSWORD, 10);

  const role = await prisma.role.upsert({
    where: { nombre: "SUPER_ADMIN" },
    update: {},
    create: { nombre: "SUPER_ADMIN" },
  });

  const user = await prisma.user.upsert({
    where: { email: EMAIL },
    update: { passwordHash, activo: true },
    create: {
      nombre: "Jose",
      apellido: "Vazquez",
      email: EMAIL,
      passwordHash,
      activo: true,
    },
  });

  await prisma.userRole.upsert({
    where: {
      userId_roleId: { userId: user.id, roleId: role.id },
    },
    update: {},
    create: { userId: user.id, roleId: role.id },
  });

  console.log("Super admin creado:");
  console.log("  Email:", EMAIL);
  console.log("  Clave:", PASSWORD);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
