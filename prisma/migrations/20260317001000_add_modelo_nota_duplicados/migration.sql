-- Add columns for duplicated/offline state on modelos_nota
-- Safe for already-updated databases.

ALTER TABLE IF EXISTS "modelos_nota"
ADD COLUMN IF NOT EXISTS "modeloOrigenId" INTEGER;

ALTER TABLE IF EXISTS "modelos_nota"
ADD COLUMN IF NOT EXISTS "activo" BOOLEAN NOT NULL DEFAULT true;

-- Self-relation FK (optional)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'modelos_nota'
  ) THEN
    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.table_constraints tc
      WHERE tc.table_schema = 'public'
        AND tc.table_name = 'modelos_nota'
        AND tc.constraint_type = 'FOREIGN KEY'
        AND tc.constraint_name = 'modelos_nota_modeloOrigenId_fkey'
    ) THEN
      ALTER TABLE "modelos_nota"
      ADD CONSTRAINT "modelos_nota_modeloOrigenId_fkey"
      FOREIGN KEY ("modeloOrigenId") REFERENCES "modelos_nota"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
  END IF;
END $$;

