# syntax=docker/dockerfile:1

FROM php:8.3-fpm-alpine

# Bibliotecas de execução e o que o Composer usa para resolver pacotes.
RUN apk add --no-cache libpq icu-libs libzip git unzip

# Extensões compiladas.
#
# `libpq-dev` e não `postgresql-dev`: o segundo arrasta o llvm — cerca de 1GB,
# para o JIT do servidor Postgres — e daqui só interessam os headers do cliente.
# `intl` é o que Laravel e Filament pedem para formatação e collation.
RUN apk add --no-cache --virtual .build-deps $PHPIZE_DEPS libpq-dev icu-dev libzip-dev \
 && docker-php-ext-install -j"$(nproc)" pdo_pgsql intl zip bcmath opcache \
 && apk del --no-network .build-deps

COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

# O container escreve em ./backend por bind mount: sem o mesmo UID do host,
# tudo o que o Composer e o Artisan geram sai pertencendo ao root.
ARG UID=1000
ARG GID=1000
RUN addgroup -g "${GID}" app 2>/dev/null || true \
 && adduser -u "${UID}" -G "$(getent group "${GID}" | cut -d: -f1)" -s /bin/sh -D app 2>/dev/null || true

ENV COMPOSER_ALLOW_SUPERUSER=1 \
    COMPOSER_MEMORY_LIMIT=-1

WORKDIR /var/www
