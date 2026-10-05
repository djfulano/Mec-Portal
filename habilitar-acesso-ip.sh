#!/bin/bash

# Sessoes root abertas com su podem nao incluir os diretorios administrativos.
export PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:${PATH:-}"
# Adiciona acesso por portas preservando os sites HTTPS existentes.
set -euo pipefail
[ "$EUID" -eq 0 ] || { echo "Execute com sudo."; exit 1; }
NGINX_LISTEN_PORT=${1:-8081}
NGINX_EVO_PORT=${2:-8090}
BACKEND_PORT=${3:-3001}
EVOLUTION_INTERNAL_PORT=${4:-8080}
for port in "$NGINX_LISTEN_PORT" "$NGINX_EVO_PORT" "$BACKEND_PORT" "$EVOLUTION_INTERNAL_PORT"; do
  [[ "$port" =~ ^[0-9]+$ ]] && [ "$port" -ge 1 ] && [ "$port" -le 65535 ] || { echo "Porta invalida"; exit 1; }
done
[ "$NGINX_LISTEN_PORT" != "$NGINX_EVO_PORT" ] || { echo "Use portas diferentes"; exit 1; }
for port in "$NGINX_LISTEN_PORT" "$NGINX_EVO_PORT"; do
  [ "$port" != "$BACKEND_PORT" ] && [ "$port" != "$EVOLUTION_INTERNAL_PORT" ] || { echo "Porta em conflito"; exit 1; }
  if ss -H -lnt "sport = :$port" | grep -q .; then echo "Porta $port ja em uso"; exit 1; fi
done
[ -f /var/www/hotspot/frontend/dist/index.html ] || { echo "Frontend nao instalado"; exit 1; }
DOMAIN_HOTSPOT=localhost
DOMAIN_EVOLUTION=localhost
if [ -e /etc/nginx/sites-available/hotspot-ip ] || [ -e /etc/nginx/sites-available/evolution-ip ]; then
  echo "Configuracao por IP ja existe; revise os arquivos antes de alterar."; exit 1
fi
cleanup() {
  rm -f /etc/nginx/sites-enabled/hotspot-ip /etc/nginx/sites-enabled/evolution-ip
  rm -f /etc/nginx/sites-available/hotspot-ip /etc/nginx/sites-available/evolution-ip
}
trap cleanup ERR
  cat > /etc/nginx/sites-available/hotspot-ip <<EOF
server {
    listen ${NGINX_LISTEN_PORT} default_server;
    server_name ${DOMAIN_HOTSPOT} _;

    root /var/www/hotspot/frontend/dist;
    index index.html;
    client_max_body_size 10M;

    set_real_ip_from 10.0.0.0/8;
    set_real_ip_from 172.16.0.0/12;
    set_real_ip_from 192.168.0.0/16;
    real_ip_header X-Forwarded-For;
    real_ip_recursive on;

    # Assets hasheados do Vite: cache longo e imutavel
    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable, max-age=31536000";
        try_files \$uri =404;
    }

    # index.html nunca cacheado (essencial pro sistema de updates)
    location = /index.html {
        add_header Cache-Control "no-store, no-cache, must-revalidate, max-age=0";
        add_header Pragma "no-cache";
        expires off;
    }

    location / {
        try_files \$uri /index.html;
    }

    location /api/ {
        proxy_pass http://localhost:${BACKEND_PORT}/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$http_host;
        proxy_cache_bypass \$http_upgrade;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 180s;
        proxy_connect_timeout 30s;
        proxy_send_timeout 180s;
    }

    location /hotspot/ {
        proxy_pass http://localhost:${BACKEND_PORT}/hotspot/;
        proxy_http_version 1.1;
        proxy_set_header Host \$http_host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    # Uploads de campanhas (pre-portal): servidos pelo backend
    location /uploads/campanhas/ {
        alias /var/www/hotspot/backend/uploads/campanhas/;
        expires 1d;
        add_header Cache-Control "public, max-age=86400";
        try_files \$uri =404;
    }

    location /uploads/ {
        alias /var/www/hotspot/frontend/dist/uploads/;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }
}
EOF

  cat > /etc/nginx/sites-available/evolution-ip <<EOF
server {
    listen ${NGINX_EVO_PORT} default_server;
    server_name ${DOMAIN_EVOLUTION} _;

    set_real_ip_from 10.0.0.0/8;
    set_real_ip_from 172.16.0.0/12;
    set_real_ip_from 192.168.0.0/16;
    real_ip_header X-Forwarded-For;
    real_ip_recursive on;

    location / {
        proxy_pass http://127.0.0.1:${EVOLUTION_INTERNAL_PORT};
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$http_host;
        proxy_cache_bypass \$http_upgrade;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF
ln -s /etc/nginx/sites-available/hotspot-ip /etc/nginx/sites-enabled/hotspot-ip
ln -s /etc/nginx/sites-available/evolution-ip /etc/nginx/sites-enabled/evolution-ip
nginx -t
systemctl reload nginx
trap - ERR
echo "Portal: http://IP_DO_SERVIDOR:$NGINX_LISTEN_PORT/"
echo "Evolution: http://IP_DO_SERVIDOR:$NGINX_EVO_PORT/manager/login"
echo "Se houver firewall ativo, libere essas duas portas para a rede desejada."
