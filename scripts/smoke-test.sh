#!/usr/bin/env bash
# ============================================================
# 🧪 Smoke-test: поднимает docker compose, ждёт API, прогоняет
# полный сценарий (депозит → подтверждение → заказ → подтверждение)
# и пишет всё в ./smoke-test.log
#
# Использование:
#   ADMIN_TG_ID=8044243116 ./scripts/smoke-test.sh
# (ADMIN_TG_ID должен совпадать с одним из ADMIN_TG_IDS в backend/.env)
# ============================================================
set -e

LOG="${LOG:-./smoke-test.log}"
ADMIN_TG_ID="${ADMIN_TG_ID:?Set ADMIN_TG_ID to one of ADMIN_TG_IDS from backend/.env}"
API="${API:-http://localhost/api}"

: > "$LOG"
exec > >(tee -a "$LOG") 2>&1

log() { echo "[$(date +%H:%M:%S)] $*"; }

log "===== [1/8] docker compose up ====="
docker compose up --build -d

log "===== [2/8] waiting for postgres ====="
for i in {1..40}; do
  if docker compose exec -T postgres pg_isready -U appuser -d shopdb >/dev/null 2>&1; then
    log "postgres ready"; break
  fi
  sleep 2
done

log "===== [3/8] waiting for api /health ====="
for i in {1..40}; do
  if curl -fsS "$API/health" >/dev/null 2>&1; then
    log "api ready"; break
  fi
  sleep 2
done

log "===== [4/8] verifying schema ====="
docker compose exec -T postgres psql -U appuser -d shopdb -c "\dt" || true

log "===== [5/8] forging admin JWT (skips Telegram initData for the test) ====="
JWT_SECRET=$(grep -E '^JWT_SECRET=' backend/.env | cut -d= -f2-)
TOKEN=$(docker compose exec -T api node -e "
const jwt=require('jsonwebtoken');
console.log(jwt.sign({tgId:'$ADMIN_TG_ID'}, process.env.JWT_SECRET, {expiresIn:'1h'}));
")
log "token len: ${#TOKEN}"

log "===== [6/8] seed admin user row ====="
docker compose exec -T postgres psql -U appuser -d shopdb -c "
INSERT INTO users (tg_id, username, first_name, lang, balance_usd, is_admin, created_at, updated_at)
VALUES ($ADMIN_TG_ID, 'smoketest', 'Smoke', 'ru', 0, true, now(), now())
ON CONFLICT (tg_id) DO UPDATE SET is_admin=true;"

log "===== [7/8] deposit flow ====="
DEP=$(curl -sS -X POST "$API/deposits" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"amountUSD":50,"crypto":"USDT"}')
echo "create:  $DEP"
DEP_ID=$(echo "$DEP" | python3 -c "import sys,json;print(json.load(sys.stdin)['id'])")
curl -sS -X POST "$API/deposits/$DEP_ID/paid" -H "Authorization: Bearer $TOKEN"; echo
curl -sS -X POST "$API/admin/deposits/$DEP_ID/confirm" -H "Authorization: Bearer $TOKEN"; echo
curl -sS "$API/me" -H "Authorization: Bearer $TOKEN"; echo

log "===== [8/8] order flow ====="
# берём первый товар из каталога
PROD=$(curl -sS "$API/catalog" | python3 -c "import sys,json;d=json.load(sys.stdin);print(d[0]['id'] if d else '')")
if [ -z "$PROD" ]; then
  log "WARN: no products in catalog — order test skipped. Add one in admin panel and re-run."
else
  ORDER=$(curl -sS -X POST "$API/orders" \
    -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
    -d "{\"totalUSD\":10,\"delivery\":false,\"items\":[{\"productId\":\"$PROD\",\"qty\":1,\"priceUSD\":10}]}")
  echo "order:   $ORDER"
  ORDER_ID=$(echo "$ORDER" | python3 -c "import sys,json;print(json.load(sys.stdin).get('id',''))")
  if [ -n "$ORDER_ID" ]; then
    curl -sS "$API/admin/awaiting" -H "Authorization: Bearer $TOKEN"; echo
    curl -sS -X POST "$API/admin/orders/$ORDER_ID/confirm" \
      -H "Authorization: Bearer $TOKEN" -F "text=smoke ok"; echo
  fi
fi

log "===== api logs (last 50) ====="
docker compose logs api --tail 50 || true

log "===== DONE ====="
echo "Full log: $LOG"