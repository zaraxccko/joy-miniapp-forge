-- Make legacy environments compatible with the Category Prisma model.
-- This migration is safe to run whether the original categories migration
-- was fully applied or only marked as applied.

CREATE TABLE IF NOT EXISTS "categories" (
    "slug" TEXT NOT NULL,
    "name" JSONB NOT NULL,
    "emoji" TEXT NOT NULL DEFAULT '✨',
    "gradient" TEXT NOT NULL DEFAULT 'gradient-primary',
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("slug")
);

ALTER TABLE "categories"
  ADD COLUMN IF NOT EXISTS "emoji" TEXT NOT NULL DEFAULT '✨',
  ADD COLUMN IF NOT EXISTS "gradient" TEXT NOT NULL DEFAULT 'gradient-primary',
  ADD COLUMN IF NOT EXISTS "sort_order" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

DO $$
DECLARE
  name_type text;
BEGIN
  SELECT data_type
    INTO name_type
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'categories'
    AND column_name = 'name';

  IF name_type IN ('text', 'character varying') THEN
    EXECUTE $sql$
      ALTER TABLE "categories"
      ALTER COLUMN "name" TYPE JSONB
      USING jsonb_build_object('ru', "name", 'en', "name")
    $sql$;
  ELSIF name_type = 'jsonb' THEN
    EXECUTE $sql$
      UPDATE "categories"
      SET "name" = jsonb_build_object(
        'ru', COALESCE("name"->>'ru', "name"->>'en', slug),
        'en', COALESCE("name"->>'en', "name"->>'ru', slug)
      )
      WHERE jsonb_typeof("name") <> 'object'
         OR ("name"->>'ru') IS NULL
         OR ("name"->>'en') IS NULL
    $sql$;
  END IF;
END $$;

UPDATE "categories"
SET "updated_at" = CURRENT_TIMESTAMP
WHERE "updated_at" IS NULL;

INSERT INTO "categories" ("slug", "name", "emoji", "gradient", "sort_order", "updated_at") VALUES
  ('gummies',   '{"ru":"Жевательное","en":"Gummies"}',   '🍬', 'gradient-grape', 1, CURRENT_TIMESTAMP),
  ('chocolate', '{"ru":"Шоколад","en":"Chocolate"}',     '🍫', 'gradient-mango', 2, CURRENT_TIMESTAMP),
  ('cookies',   '{"ru":"Печенье","en":"Cookies"}',       '🍪', 'gradient-mango', 3, CURRENT_TIMESTAMP),
  ('drinks',    '{"ru":"Напитки","en":"Drinks"}',        '🥤', 'gradient-mint',  4, CURRENT_TIMESTAMP),
  ('vapes',     '{"ru":"Вейпы","en":"Vapes"}',           '💨', 'gradient-grape', 5, CURRENT_TIMESTAMP)
ON CONFLICT ("slug") DO NOTHING;