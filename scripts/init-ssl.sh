#!/bin/bash
# Первый запуск: получить SSL-сертификат Let's Encrypt
# Замените startupengine.ru и admin@startupengine.ru на свои значения

DOMAIN="startupengine.ru"
EMAIL="admin@startupengine.ru"

docker compose -f docker-compose.prod.yml run --rm certbot \
  certonly --webroot -w /var/www/certbot \
  -d $DOMAIN -d www.$DOMAIN \
  --email $EMAIL --agree-tos --no-eff-email

echo "Сертификат получен. Перезапустите nginx:"
echo "docker compose -f docker-compose.prod.yml restart frontend"
