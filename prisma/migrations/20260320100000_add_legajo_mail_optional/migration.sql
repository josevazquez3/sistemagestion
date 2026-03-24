-- Add optional email field for Legajo
-- La tabla puede no existir en la shadow DB si el historial no incluye su creación inicial.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'legajos'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'legajos'
      AND column_name = 'mail'
  ) THEN
    ALTER TABLE "legajos" ADD COLUMN "mail" TEXT;
  END IF;
END $$;
