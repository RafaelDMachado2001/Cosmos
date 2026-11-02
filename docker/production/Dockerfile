# syntax=docker/dockerfile:1

FROM node:22-alpine AS assets
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npx vite build --config vite.prerender.config.ts \
 && npm run build:admin

FROM composer:2 AS vendor
WORKDIR /app
COPY backend/composer.json backend/composer.lock ./
RUN composer install --no-dev --no-interaction --prefer-dist --no-progress --no-scripts --no-autoloader --ignore-platform-reqs
COPY backend/ ./
RUN composer dump-autoload --no-dev --optimize --classmap-authoritative --no-scripts

FROM dunglas/frankenphp:1.13.3-php8.3.36-alpine

RUN install-php-extensions pdo_pgsql intl zip bcmath opcache gd exif \
 && apk add --no-cache nodejs

COPY docker/production/php.ini "$PHP_INI_DIR/conf.d/zz-production.ini"
COPY docker/php/php.ini "$PHP_INI_DIR/conf.d/zz-rdm.ini"

WORKDIR /app
COPY --from=vendor /app /app
COPY --from=assets /app/backend/public/admin/rdm-studio /app/public/admin/rdm-studio
COPY --from=assets /app/dist-ssr /srv/render/dist-ssr

RUN mkdir -p storage/app storage/framework/cache storage/framework/sessions storage/framework/views storage/logs bootstrap/cache \
 && php artisan package:discover --ansi \
 && php artisan filament:assets \
 && chown -R www-data:www-data storage bootstrap/cache /data/caddy /config/caddy

ENV RENDER_DIR=/srv/render \
    APP_ENV=production \
    APP_DEBUG=false \
    LOG_CHANNEL=stderr \
    SERVER_NAME=:8080 \
    CADDY_SERVER_EXTRA_DIRECTIVES="header -Server"

COPY docker/production/entrypoint.sh /usr/local/bin/rdm-entrypoint
RUN chmod +x /usr/local/bin/rdm-entrypoint

USER www-data
EXPOSE 8080
ENTRYPOINT ["rdm-entrypoint"]
CMD ["--config", "/etc/frankenphp/Caddyfile", "--adapter", "caddyfile"]
