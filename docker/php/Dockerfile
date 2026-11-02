# syntax=docker/dockerfile:1

FROM node:22-alpine AS runner
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .

ARG VITE_SITE_URL=http://localhost:8080
ENV VITE_SITE_URL=${VITE_SITE_URL}

ARG VITE_API_URL=/
ENV VITE_API_URL=${VITE_API_URL}

RUN npm run build

FROM php:8.3.36-fpm-alpine

RUN apk add --no-cache libpq icu-libs libzip libwebp libpng libjpeg-turbo git unzip

RUN apk add --no-cache --virtual .build-deps $PHPIZE_DEPS libpq-dev icu-dev libzip-dev libwebp-dev libpng-dev libjpeg-turbo-dev \
 && docker-php-ext-configure gd --with-webp --with-jpeg \
 && docker-php-ext-install -j"$(nproc)" pdo_pgsql intl zip bcmath opcache gd exif \
 && apk del --no-network .build-deps

COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

RUN apk add --no-cache nodejs

COPY --from=runner /app/dist-ssr /srv/render/dist-ssr
COPY --from=runner /app/node_modules /srv/render/node_modules

ARG UID=1000
ARG GID=1000
RUN addgroup -g "${GID}" app 2>/dev/null || true \
 && adduser -u "${UID}" -G "$(getent group "${GID}" | cut -d: -f1)" -s /bin/sh -D app 2>/dev/null || true

RUN chown -R app:app /srv/render/dist-ssr

COPY docker/php/php.ini "$PHP_INI_DIR/conf.d/zz-rdm.ini"

ENV COMPOSER_ALLOW_SUPERUSER=1 \
    COMPOSER_MEMORY_LIMIT=-1

WORKDIR /var/www
