-- CreateTable (IF NOT EXISTS: compatible si la app ya creó la tabla vía ensure)
CREATE TABLE IF NOT EXISTS "configuracion_tesoreria" (
    "id" SERIAL NOT NULL,
    "saldoInicialConciliacion" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "saldoInicialConciliacionCargado" BOOLEAN NOT NULL DEFAULT false,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "configuracion_tesoreria_pkey" PRIMARY KEY ("id")
);
