-- CreateTable
CREATE TABLE "categories" (
    "slug" TEXT NOT NULL,
    "name" JSONB NOT NULL,
    "emoji" TEXT NOT NULL DEFAULT '✨',
    "gradient" TEXT NOT NULL DEFAULT 'gradient-primary',
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("slug")
);

-- Seed default categories so the shop is not empty after migration
INSERT INTO "categories" ("slug", "name", "emoji", "gradient", "sort_order", "updated_at") VALUES
  ('gummies',   '{"ru":"Жевательное","en":"Gummies"}',   '🍬', 'gradient-grape', 1, CURRENT_TIMESTAMP),
  ('chocolate', '{"ru":"Шоколад","en":"Chocolate"}',     '🍫', 'gradient-mango', 2, CURRENT_TIMESTAMP),
  ('cookies',   '{"ru":"Печенье","en":"Cookies"}',       '🍪', 'gradient-mango', 3, CURRENT_TIMESTAMP),
  ('drinks',    '{"ru":"Напитки","en":"Drinks"}',        '🥤', 'gradient-mint',  4, CURRENT_TIMESTAMP),
  ('vapes',     '{"ru":"Вейпы","en":"Vapes"}',           '💨', 'gradient-grape', 5, CURRENT_TIMESTAMP)
ON CONFLICT ("slug") DO NOTHING;
