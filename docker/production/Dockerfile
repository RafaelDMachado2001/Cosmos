# syntax=docker/dockerfile:1

# A imagem de produção do backend: o que roda no Cloud Run.
#
# Diferente de docker/php/Dockerfile (o do `docker compose`): sem prerender,
# sem RegenerateSite — o site é reconstruído pelo build da Vercel —, sem bind
# mount e sem Nginx. FrankenPHP é servidor HTTP e PHP num processo só, que é
# o que o Cloud Run espera de um contêiner.
#
# O contexto é a raiz do repositório; Dockerfile.dockerignore, ao lado deste,
# substitui o .dockerignore da raiz (que exclui backend/, por causa do `web`).

# --- Node: o serializador de blocos e o bundle do RDM Studio ----------------
FROM node:22-alpine AS assets
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
# Só o bundle de SSR — o publicar do Studio chama dist-ssr/draft-blocks-cli.js
# (DraftBlocksCli). Sem o postbuild: o prerender não roda aqui.
RUN npx vite build --config vite.prerender.config.ts \
 && npm run build:admin

# --- Composer -----------------------------------------------------------------
FROM composer:2 AS vendor
WORKDIR /app
COPY backend/composer.json backend/composer.lock ./
RUN composer install --no-dev --no-interaction --prefer-dist --no-progress --no-scripts --no-autoloader --ignore-platform-reqs
COPY backend/ ./
# Sem scripts: o package:discover roda no estágio final, que tem as extensões.
RUN composer dump-autoload --no-dev --optimize --classmap-authoritative --no-scripts

# --- Runtime ----------------------------------------------------------------
# PHP fixo em 8.3.36: corrige o PHP2Shell (CVE-2026-109618/109619). A 1.12.x
# não tem build com ele; a 1.13.3 é a primeira.
FROM dunglas/frankenphp:1.13.3-php8.3.36-alpine

RUN install-php-extensions pdo_pgsql intl zip bcmath opcache gd exif \
 && apk add --no-cache nodejs

COPY docker/production/php.ini "$PHP_INI_DIR/conf.d/zz-production.ini"
COPY docker/php/php.ini "$PHP_INI_DIR/conf.d/zz-rdm.ini"

WORKDIR /app
COPY --from=vendor /app /app
# O bundle do Studio vai na imagem, não por bind mount como no compose.
COPY --from=assets /app/backend/public/admin/rdm-studio /app/public/admin/rdm-studio
# O CLI do serializador e o chunk que ele importa — nada de node_modules: o
# bundle não tem dependência externa (core/ é TypeScript puro).
COPY --from=assets /app/dist-ssr /srv/render/dist-ssr

# Os assets do Filament são publicados no build; a imagem nasce completa.
# Os diretórios de storage ficam fora do contexto (Dockerfile.dockerignore) e o
# artisan não sobe sem eles.
RUN mkdir -p storage/app storage/framework/cache storage/framework/sessions storage/framework/views storage/logs bootstrap/cache \
 && php artisan package:discover --ansi \
 && php artisan filament:assets \
 && chown -R www-data:www-data storage bootstrap/cache /data/caddy /config/caddy

ENV RENDER_DIR=/srv/render \
    APP_ENV=production \
    APP_DEBUG=false \
    LOG_CHANNEL=stderr \
    SERVER_NAME=:8080 \
    # Sem "Server: FrankenPHP Caddy": a stack não é da conta de quem pede.
    CADDY_SERVER_EXTRA_DIRECTIVES="header -Server"

COPY docker/production/entrypoint.sh /usr/local/bin/rdm-entrypoint
RUN chmod +x /usr/local/bin/rdm-entrypoint

USER www-data
EXPOSE 8080
ENTRYPOINT ["rdm-entrypoint"]
# O mesmo CMD da imagem base: o docker-php-entrypoint dela vira `frankenphp run`.
CMD ["--config", "/etc/frankenphp/Caddyfile", "--adapter", "caddyfile"]
