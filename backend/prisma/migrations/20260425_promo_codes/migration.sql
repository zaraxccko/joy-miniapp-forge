-- Promo codes: percentage discount, one-time per user.

CREATE TABLE IF NOT EXISTS "promo_codes" (
    "id"             TEXT NOT NULL,
    "code"           TEXT NOT NULL,
    "discount_pct"   INTEGER NOT NULL,
    "active"         BOOLEAN NOT NULL DEFAULT true,
    "created_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "promo_codes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "promo_codes_code_key" ON "promo_codes"("code");

CREATE TABLE IF NOT EXISTS "promo_redemptions" (
    "id"            TEXT NOT NULL,
    "promo_id"      TEXT NOT NULL,
    "user_tg_id"    BIGINT NOT NULL,
    "order_id"      TEXT,
    "discount_pct"  INTEGER NOT NULL,
    "created_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "promo_redemptions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "promo_redemptions_promo_user_key"
    ON "promo_redemptions"("promo_id", "user_tg_id");
CREATE INDEX IF NOT EXISTS "promo_redemptions_user_idx"
    ON "promo_redemptions"("user_tg_id");

ALTER TABLE "promo_redemptions"
    ADD CONSTRAINT "promo_redemptions_promo_fk"
    FOREIGN KEY ("promo_id") REFERENCES "promo_codes"("id") ON DELETE CASCADE;
