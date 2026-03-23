CREATE TABLE "FacturaProveedor" (
    "id" SERIAL NOT NULL,
    "mes" INTEGER NOT NULL,
    "anio" INTEGER NOT NULL,
    "proveedorId" INTEGER NOT NULL,
    "puntoVenta" INTEGER NOT NULL,
    "nroFactura" INTEGER NOT NULL,
    "cuit" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "descripcion" TEXT NOT NULL,
    "tipoComprobante" TEXT NOT NULL,
    "importe" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FacturaProveedor_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "FacturaProveedor"
ADD CONSTRAINT "FacturaProveedor_proveedorId_fkey"
FOREIGN KEY ("proveedorId") REFERENCES "Proveedor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
