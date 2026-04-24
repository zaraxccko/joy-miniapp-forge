-- Initial schema for fresh installs.
-- Kept under the original migration name so existing deploy instructions stay valid.

DO $$
BEGIN
  CREATE TYPE "DepositStatus" AS ENUM ('pending', 'awaiting', 'confirmed', 'cancelled');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "OrderStatus" AS ENUM ('awaiting', 'paid', 'in_delivery', 'completed', 'cancelled');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "users" (
  "tg_id" BIGINT NOT NULL,
  "username" TEXT,
  "first_name" TEXT,
  "last_name" TEXT,
  "photo_url" TEXT,
  "lang" TEXT NOT NULL DEFAULT 'ru',
  "city_slug" TEXT,
  "balance_usd" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "is_admin" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "users_pkey" PRIMARY KEY ("tg_id")
);

CREATE TABLE IF NOT EXISTS "products" (
  "id" TEXT NOT NULL,
  "name" JSONB NOT NULL,
  "description" JSONB NOT NULL,
  "category" TEXT NOT NULL,
  "price_thb" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "thc_mg" INTEGER,
  "cbd_mg" INTEGER,
  "weight" TEXT,
  "in_stock" INTEGER NOT NULL DEFAULT 0,
  "gradient" TEXT NOT NULL DEFAULT 'gradient-primary',
  "emoji" TEXT NOT NULL DEFAULT '📦',
  "image_url" TEXT,
  "featured" BOOLEAN NOT NULL DEFAULT false,
  "badge" JSONB,
  "cities" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "districts" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "variants" (
  "id" TEXT NOT NULL,
  "product_id" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "grams" DOUBLE PRECISION NOT NULL,
  "prices_by_country" JSONB NOT NULL,
  "stashes" JSONB NOT NULL DEFAULT '[]',
  "districts" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  CONSTRAINT "variants_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "variants_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "deposits" (
  "id" TEXT NOT NULL,
  "user_tg_id" BIGINT NOT NULL,
  "amount_usd" DOUBLE PRECISION NOT NULL,
  "crypto" TEXT NOT NULL,
  "address" TEXT NOT NULL,
  "status" "DepositStatus" NOT NULL DEFAULT 'pending',
  "paid_at" TIMESTAMP(3),
  "confirmed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "deposits_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "deposits_user_tg_id_fkey" FOREIGN KEY ("user_tg_id") REFERENCES "users"("tg_id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "orders" (
  "id" TEXT NOT NULL,
  "user_tg_id" BIGINT NOT NULL,
  "total_usd" DOUBLE PRECISION NOT NULL,
  "items" JSONB NOT NULL,
  "delivery" BOOLEAN NOT NULL DEFAULT false,
  "delivery_address" TEXT,
  "status" "OrderStatus" NOT NULL DEFAULT 'awaiting',
  "crypto" TEXT,
  "pay_address" TEXT,
  "confirm_photo_url" TEXT,
  "confirm_photo_urls" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "confirm_text" TEXT,
  "confirmed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "orders_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "orders_user_tg_id_fkey" FOREIGN KEY ("user_tg_id") REFERENCES "users"("tg_id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "broadcast_log" (
  "id" TEXT NOT NULL,
  "segment" TEXT NOT NULL,
  "text" TEXT NOT NULL,
  "image_url" TEXT,
  "button" JSONB,
  "sent_count" INTEGER NOT NULL DEFAULT 0,
  "failed_count" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "broadcast_log_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "variants_product_id_slug_key" ON "variants"("product_id", "slug");
CREATE INDEX IF NOT EXISTS "deposits_user_tg_id_idx" ON "deposits"("user_tg_id");
CREATE INDEX IF NOT EXISTS "deposits_status_idx" ON "deposits"("status");
CREATE INDEX IF NOT EXISTS "orders_user_tg_id_idx" ON "orders"("user_tg_id");
CREATE INDEX IF NOT EXISTS "orders_status_idx" ON "orders"("status");
