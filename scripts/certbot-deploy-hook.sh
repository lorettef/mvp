#!/bin/sh
# Вызывается certbot-ом как --deploy-hook после успешного продления сертификата.
# Перезапускает frontend-контейнер, чтобы nginx перечитал новый сертификат
# (entrypoint копирует сертификат из /etc/letsencrypt/live/ в /etc/nginx/certs/).
# Запускается ВНУТРИ certbot-контейнера, куда примонтирован docker.sock.

python3 - <<'PY'
import socket

s = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
s.connect("/var/run/docker.sock")
req = (
    b"POST /containers/startup_frontend/restart HTTP/1.1\r\n"
    b"Host: localhost\r\n"
    b"Content-Length: 0\r\n"
    b"Connection: close\r\n"
    b"\r\n"
)
s.sendall(req)
s.close()
PY
