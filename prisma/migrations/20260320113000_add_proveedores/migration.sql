CREATE TABLE "Proveedor" (
    "id" SERIAL NOT NULL,
    "proveedor" TEXT NOT NULL,
    "nombreContacto" TEXT,
    "alias" TEXT,
    "cuit" TEXT,
    "cuentaDebitoTipoNum" TEXT,
    "banco" TEXT,
    "direccion" TEXT,
    "ciudad" TEXT,
    "telefono" TEXT,
    "email" TEXT,
    "formaPago" TEXT,
    "cbu" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Proveedor_pkey" PRIMARY KEY ("id")
);
