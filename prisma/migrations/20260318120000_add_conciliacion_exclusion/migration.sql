-- CreateTable
CREATE TABLE "conciliacion_exclusion" (
    "id" SERIAL NOT NULL,
    "conciliacionId" INTEGER NOT NULL,
    "movimientoId" INTEGER NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conciliacion_exclusion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "conciliacion_exclusion_conciliacionId_movimientoId_key" ON "conciliacion_exclusion"("conciliacionId", "movimientoId");

-- AddForeignKey
ALTER TABLE "conciliacion_exclusion" ADD CONSTRAINT "conciliacion_exclusion_conciliacionId_fkey" FOREIGN KEY ("conciliacionId") REFERENCES "conciliacion_banco"("id") ON DELETE CASCADE ON UPDATE CASCADE;
