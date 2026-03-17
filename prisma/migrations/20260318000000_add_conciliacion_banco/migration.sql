-- CreateTable
CREATE TABLE "conciliacion_banco" (
    "id" SERIAL NOT NULL,
    "mes" INTEGER NOT NULL,
    "anio" INTEGER NOT NULL,
    "saldoAnterior" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "totalIngresos" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "totalSalidas" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "totalGastos" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "subtotal" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "totalConciliado" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "cerrado" BOOLEAN NOT NULL DEFAULT false,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conciliacion_banco_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conciliacion_asignacion" (
    "id" SERIAL NOT NULL,
    "conciliacionId" INTEGER NOT NULL,
    "cuentaCodigo" TEXT NOT NULL,
    "cuentaNombre" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conciliacion_asignacion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "conciliacion_banco_mes_anio_key" ON "conciliacion_banco"("mes", "anio");

-- CreateIndex
CREATE UNIQUE INDEX "conciliacion_asignacion_conciliacionId_cuentaCodigo_key" ON "conciliacion_asignacion"("conciliacionId", "cuentaCodigo");

-- AddForeignKey
ALTER TABLE "conciliacion_asignacion" ADD CONSTRAINT "conciliacion_asignacion_conciliacionId_fkey" FOREIGN KEY ("conciliacionId") REFERENCES "conciliacion_banco"("id") ON DELETE CASCADE ON UPDATE CASCADE;
