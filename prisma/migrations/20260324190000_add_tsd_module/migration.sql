-- CreateEnum
CREATE TYPE "TsdEstado" AS ENUM ('PARA_TRATAR', 'CEDULA_NOTIFICACION', 'APELACION', 'DEVUELTO_A_DTO');

-- CreateTable
CREATE TABLE "tsd_expedientes" (
    "id" SERIAL NOT NULL,
    "nroExpte" TEXT NOT NULL,
    "caratula" TEXT NOT NULL,
    "distrito" TEXT NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tsd_expedientes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "tsd_expedientes_nroExpte_key" ON "tsd_expedientes"("nroExpte");

-- CreateTable
CREATE TABLE "tsd_movimientos" (
    "id" SERIAL NOT NULL,
    "expedienteId" INTEGER NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "estado" "TsdEstado" NOT NULL,
    "observacion" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tsd_movimientos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tsd_movimientos_expedienteId_idx" ON "tsd_movimientos"("expedienteId");

-- AddForeignKey
ALTER TABLE "tsd_movimientos" ADD CONSTRAINT "tsd_movimientos_expedienteId_fkey" FOREIGN KEY ("expedienteId") REFERENCES "tsd_expedientes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
