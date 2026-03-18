-- La tabla puede no existir en la shadow DB si el historial no incluye su creación inicial.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'movimientos_extracto'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'movimientos_extracto'
      AND column_name = 'codOperativoEditado'
  ) THEN
    ALTER TABLE "movimientos_extracto"
      ADD COLUMN "codOperativoEditado" BOOLEAN NOT NULL DEFAULT false;
  END IF;
END $$;
