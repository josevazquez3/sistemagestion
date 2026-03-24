-- AlterTable
-- La tabla puede no existir en la shadow DB si el historial no incluye su creación inicial.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'ingresos_distritos'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'ingresos_distritos'
      AND column_name = 'periodo'
  ) THEN
    ALTER TABLE "ingresos_distritos" ADD COLUMN "periodo" TEXT;
  END IF;
END $$;
