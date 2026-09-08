#!/usr/bin/env bash
# Startup Engine — резервная копия PostgreSQL (pg_dump) в timestamped .sql.gz.
#
# Использование (на production-сервере, из /app/mvp):
#   ./scripts/backup-db.sh
#
# Рекомендуется запускать по cron (например, раз в день):
#   0 3 * * * cd /app/mvp && ./scripts/backup-db.sh >> /var/log/se-backup.log 2>&1
#
# Переменные окружения (опционально):
#   BACKUP_DIR — куда складывать бэкапы (по умолчанию ./backups)
#   KEEP       — сколько последних бэкапов хранить (по умолчанию 15)
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-./backups}"
KEEP="${KEEP:-15}"
PG_USER="${POSTGRES_USER:-postgres}"
PG_DB="${POSTGRES_DB:-startup_engine}"

mkdir -p "$BACKUP_DIR"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
FILE="$BACKUP_DIR/startup_engine-$TIMESTAMP.sql.gz"

docker compose -f docker-compose.prod.yml exec -T db \
  pg_dump -U "$PG_USER" "$PG_DB" | gzip > "$FILE"

echo "[backup] written: $FILE ($(du -h "$FILE" | cut -f1))"

# Ротация: оставляем KEEP последних файлов.
ls -1t "$BACKUP_DIR"/startup_engine-*.sql.gz 2>/dev/null | tail -n +"$((KEEP + 1))" | xargs -r rm -f
