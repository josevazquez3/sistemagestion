-- CreateTable
CREATE TABLE "cuit_distritos" (
    "id" SERIAL NOT NULL,
    "distrito" TEXT NOT NULL,
    "cuit" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cuit_distritos_pkey" PRIMARY KEY ("id")
);
