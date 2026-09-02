#!/bin/bash
# Первый запуск: получить SSL-сертификат Let's Encrypt
# Замените mvp.poicho.ru и admin@poicho.ru на свои значения при необходимости

DOMAIN="mvp.poicho.ru"
EMAIL="admin@poicho.ru"

docker compose -f docker-compose.prod.yml run --rm certbot \
  certonly --webroot -w /var/www/certbot \
  -d $DOMAIN -d www.$DOMAIN \
  --email $EMAIL --agree-tos --no-eff-email

echo "Сертификат получен. Перезапустите nginx:"
echo "docker compose -f docker-compose.prod.yml restart frontend"
