-- Add multi-photo confirmation support to orders
ALTER TABLE "orders"
  ADD COLUMN IF NOT EXISTS "confirm_photo_urls" TEXT[] NOT NULL DEFAULT '{}';
