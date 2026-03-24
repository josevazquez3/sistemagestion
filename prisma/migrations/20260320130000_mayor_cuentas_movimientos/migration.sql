-- CreateTable
CREATE TABLE "mayor_cuentas" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mayor_cuentas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mayor_movimientos" (
    "id" SERIAL NOT NULL,
    "cuentaId" INTEGER NOT NULL,
    "fecha" TIMESTAMP(3),
    "concepto" TEXT NOT NULL,
    "importe" DOUBLE PRECISION NOT NULL,
    "origen" TEXT NOT NULL,
    "origenId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mayor_movimientos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "mayor_movimientos_cuentaId_idx" ON "mayor_movimientos"("cuentaId");

-- CreateIndex
CREATE INDEX "mayor_movimientos_origen_origenId_idx" ON "mayor_movimientos"("origen", "origenId");

-- AddForeignKey
ALTER TABLE "mayor_movimientos" ADD CONSTRAINT "mayor_movimientos_cuentaId_fkey" FOREIGN KEY ("cuentaId") REFERENCES "mayor_cuentas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- UniqueIndex (PostgreSQL: varias filas con origenId NULL siguen siendo válidas para MANUAL)
CREATE UNIQUE INDEX "mayor_movimientos_origen_origenId_key" ON "mayor_movimientos"("origen", "origenId");
