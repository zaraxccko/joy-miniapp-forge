#!/bin/sh
set -eu

DOMAINS="${APP_DOMAINS:-}"

if [ -z "$DOMAINS" ]; then
  SOURCE_URL="${WEBAPP_URL:-${VITE_API_URL:-}}"
  if [ -n "$SOURCE_URL" ]; then
    HOST=$(printf '%s' "$SOURCE_URL" | sed -E 's#^[A-Za-z]+://##; s#/.*$##; s#:.*$##')
    if [ -n "$HOST" ]; then
      case "$HOST" in
        www.*)
          ROOT_HOST=${HOST#www.}
          DOMAINS="$HOST, $ROOT_HOST"
          ;;
        *)
          DOMAINS="$HOST, www.$HOST"
          ;;
      esac
    fi
  fi
fi

if [ -z "$DOMAINS" ]; then
  echo "[proxy] APP_DOMAINS is empty and could not be derived from WEBAPP_URL or VITE_API_URL" >&2
  exit 1
fi

export APP_DOMAINS="$DOMAINS"
echo "[proxy] starting Caddy for domains: $APP_DOMAINS"
exec caddy run --config /etc/caddy/Caddyfile --adapter caddyfile