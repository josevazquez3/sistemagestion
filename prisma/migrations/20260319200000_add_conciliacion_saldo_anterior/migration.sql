-- CreateTable
CREATE TABLE "conciliacion_saldo_anterior" (
    "id" SERIAL NOT NULL,
    "cuentaId" INTEGER NOT NULL,
    "mes" INTEGER NOT NULL,
    "anio" INTEGER NOT NULL,
    "saldo" DECIMAL(15,2) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conciliacion_saldo_anterior_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "conciliacion_saldo_anterior_cuentaId_mes_anio_key" ON "conciliacion_saldo_anterior"("cuentaId", "mes", "anio");
