#!/usr/bin/env bash
set -euo pipefail

# Startup Engine — серверная подготовка к деплою через GitHub Actions.
# Запускать на ЧИСТОМ сервере (Ubuntu 22.04/24.04 или Debian 11/12) от root:
#   curl -fsSL https://raw.githubusercontent.com/lorettef/mvp/main/scripts/setup-server.sh | bash

echo "=== [1/3] Устанавливаю базовые пакеты (curl, git) ==="
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y curl git ca-certificates

echo "=== [2/3] Устанавливаю Docker + Compose ==="
if ! command -v docker >/dev/null 2>&1; then
  curl -fsSL https://get.docker.com | sh
fi
docker --version
docker compose version

echo "=== [3/3] Клонирую репозиторий в /app/mvp ==="
mkdir -p /app
if [ ! -d /app/mvp/.git ]; then
  git clone https://github.com/lorettef/mvp.git /app/mvp
fi
cd /app/mvp
git checkout main 2>/dev/null || true
git pull

echo "=== Генерирую SSH-ключ для GitHub Actions (деплой) ==="
mkdir -p /root/.ssh && chmod 700 /root/.ssh
if [ ! -f /root/.ssh/github_deploy_key ]; then
  ssh-keygen -t ed25519 -f /root/.ssh/github_deploy_key -N "" -C "github-actions-deploy"
fi
grep -qxF "$(cat /root/.ssh/github_deploy_key.pub)" /root/.ssh/authorized_keys 2>/dev/null \
  || cat /root/.ssh/github_deploy_key.pub >> /root/.ssh/authorized_keys
chmod 600 /root/.ssh/authorized_keys

echo ""
echo "=============================================================="
echo "ГОТОВО. Скопируйте ПРИВАТНЫЙ КЛЮЧ ниже целиком (от BEGIN до END)"
echo "в GitHub-секрет с именем SSH_PRIVATE_KEY:"
echo "=============================================================="
cat /root/.ssh/github_deploy_key
echo "=============================================================="
echo "После добавления всех секретов сделайте любой пуш в main — деплой пойдёт автоматически."
