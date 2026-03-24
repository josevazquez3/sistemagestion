-- CreateTable
CREATE TABLE "legal_historial_tsd" (
    "id" SERIAL NOT NULL,
    "titulo" TEXT NOT NULL,
    "fechaOficio" TIMESTAMP(3) NOT NULL,
    "archivoNombre" TEXT,
    "archivoUrl" TEXT,
    "archivoKey" TEXT,
    "fechaCarga" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "legal_historial_tsd_pkey" PRIMARY KEY ("id")
);
