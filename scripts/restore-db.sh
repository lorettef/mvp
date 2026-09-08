#!/usr/bin/env bash
# Startup Engine — восстановление PostgreSQL из бэкапа, созданного backup-db.sh.
#
# Использование:
#   ./scripts/restore-db.sh /app/mvp/backups/startup_engine-YYYYMMDD-HHMMSS.sql.gz
#
# ВНИМАНИЕ: восстановление ПЕРЕЗАПИСЫВАЕТ текущую базу. Убедитесь, что бэкап
# актуален, и при необходимости сделайте свежий бэкап перед restore.
set -euo pipefail

DUMP="${1:?Usage: restore-db.sh <dump.sql.gz>}"
PG_USER="${POSTGRES_USER:-postgres}"
PG_DB="${POSTGRES_DB:-startup_engine}"

if [ ! -f "$DUMP" ]; then
  echo "[restore] ERROR: file not found: $DUMP" >&2
  exit 1
fi

echo "[restore] restoring $PG_DB from $DUMP ..."
gunzip -c "$DUMP" | docker compose -f docker-compose.prod.yml exec -T db \
  psql -U "$PG_USER" -d "$PG_DB"

echo "[restore] done. Проверьте приложение (https://<домен>/health)."
