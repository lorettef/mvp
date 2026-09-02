#!/bin/bash
# Первый запуск: получить SSL-сертификат Let's Encrypt.
# Перед запуском должен работать `docker compose up -d` — frontend-контейнер
# поднимает nginx с self-signed заглушкой (см. frontend/docker-entrypoint.sh),
# которая отдаёт /.well-known/acme-challenge/ на порту 80 для webroot-валидации.

set -euo pipefail

DOMAIN="mvp.poicho.ru"
EMAIL="admin@poicho.ru"

# --entrypoint certbot переопределяет дефолтный entrypoint сервиса certbot
# (бесконечный цикл renew), чтобы выполнить именно certonly.
docker compose -f docker-compose.prod.yml run --rm --entrypoint certbot certbot \
  certonly --webroot -w /var/www/certbot \
  -d "$DOMAIN" \
  --email "$EMAIL" --agree-tos --no-eff-email

echo "Сертификат получен. Перезапускаю frontend, чтобы nginx подхватил реальный сертификат:"
docker compose -f docker-compose.prod.yml restart frontend
