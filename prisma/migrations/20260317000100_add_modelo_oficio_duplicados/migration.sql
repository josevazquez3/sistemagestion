-- Add columns for duplicated/offline state on modelos_oficio
-- Using IF NOT EXISTS to be safe on already-updated databases.

ALTER TABLE IF EXISTS "modelos_oficio"
ADD COLUMN IF NOT EXISTS "modeloOrigenId" INTEGER;

ALTER TABLE IF EXISTS "modelos_oficio"
ADD COLUMN IF NOT EXISTS "activo" BOOLEAN NOT NULL DEFAULT true;

-- Self-relation FK (optional)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'modelos_oficio'
  ) THEN
    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.table_constraints tc
      WHERE tc.table_schema = 'public'
        AND tc.table_name = 'modelos_oficio'
        AND tc.constraint_type = 'FOREIGN KEY'
        AND tc.constraint_name = 'modelos_oficio_modeloOrigenId_fkey'
    ) THEN
      ALTER TABLE "modelos_oficio"
      ADD CONSTRAINT "modelos_oficio_modeloOrigenId_fkey"
      FOREIGN KEY ("modeloOrigenId") REFERENCES "modelos_oficio"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
  END IF;
END $$;

