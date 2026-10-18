#!/bin/sh
set -e

# Antes de tudo: configuração que não serve para produção derruba o boot, e o
# Cloud Run mantém o tráfego na revisão anterior.
php artisan env:assert-production

# Os caches de configuração e rota dependem das variáveis de ambiente, que só
# existem quando o Cloud Run sobe o contêiner — no build, ainda não.
php artisan config:cache
php artisan route:cache
php artisan view:cache

exec docker-php-entrypoint "$@"
