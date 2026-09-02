#!/bin/sh
set -e

DOMAIN="mvp.poicho.ru"
SRC="/etc/letsencrypt/live/${DOMAIN}"
DST="/etc/nginx/certs"

mkdir -p "$DST"

if [ -f "$SRC/fullchain.pem" ] && [ -f "$SRC/privkey.pem" ]; then
  echo "[entrypoint] real cert found at ${SRC}, copying into ${DST}"
  cp -Lf "$SRC/fullchain.pem" "$DST/fullchain.pem"
  cp -Lf "$SRC/privkey.pem" "$DST/privkey.pem"
else
  echo "[entrypoint] no real cert — generating self-signed bootstrap (nginx must start for ACME webroot)"
  openssl req -x509 -nodes -newkey rsa:2048 -days 30 \
    -keyout "$DST/privkey.pem" \
    -out "$DST/fullchain.pem" \
    -subj "/CN=${DOMAIN}"
fi

exec "$@"
