# syntax=docker/dockerfile:1

# O runner do prerender. Mesma origem do build do `web`: um segundo caminho de
# compilacao divergiria do primeiro no primeiro ajuste.
FROM node:22-alpine AS runner
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .

# A origem do canonical, do hreflang e do sitemap fica assada no bundle do
# prerender. Sem o mesmo valor do `web`, a primeira publicacao regravaria todas
# as paginas apontando para o padrao de desenvolvimento.
ARG VITE_SITE_URL=http://localhost:8080
ENV VITE_SITE_URL=${VITE_SITE_URL}

# O molde que o job usa sai deste build, mas as paginas que ele grava sao
# servidas com os assets do build do `web`. Os nomes com hash so coincidem se as
# entradas coincidirem: qualquer ARG que o estagio de build do `web` tenha
# precisa estar aqui com o mesmo valor. O prerender recusa um molde cujos assets
# o destino nao tem (src/prerender/assets.ts).
ARG VITE_API_URL=/
ENV VITE_API_URL=${VITE_API_URL}

RUN npm run build

FROM php:8.3-fpm-alpine

# Bibliotecas de execução e o que o Composer usa para resolver pacotes.
# `libwebp`/`libpng`/`libjpeg-turbo` ficam em tempo de execução: é o que o GD
# lê para redimensionar e gravar o WebP que o RDM Studio grava em `media`
# (fase do RDM Studio, upload de imagem — a origem pode chegar em qualquer
# formato comum, inclusive JPEG de câmera).
RUN apk add --no-cache libpq icu-libs libzip libwebp libpng libjpeg-turbo git unzip

# Extensões compiladas.
#
# `libpq-dev` e não `postgresql-dev`: o segundo arrasta o llvm — cerca de 1GB,
# para o JIT do servidor Postgres — e daqui só interessam os headers do cliente.
# `intl` é o que Laravel e Filament pedem para formatação e collation.
RUN apk add --no-cache --virtual .build-deps $PHPIZE_DEPS libpq-dev icu-dev libzip-dev libwebp-dev libpng-dev libjpeg-turbo-dev \
 && docker-php-ext-configure gd --with-webp --with-jpeg \
 && docker-php-ext-install -j"$(nproc)" pdo_pgsql intl zip bcmath opcache gd exif \
 && apk del --no-network .build-deps

COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

# Node no container do backend e o preco de nao ter um quarto servico. Fica
# registrado na spec como o primeiro candidato a mudar se o deploy apertar.
RUN apk add --no-cache nodejs

COPY --from=runner /app/dist-ssr /srv/render/dist-ssr
COPY --from=runner /app/node_modules /srv/render/node_modules

# O container escreve em ./backend por bind mount: sem o mesmo UID do host,
# tudo o que o Composer e o Artisan geram sai pertencendo ao root.
ARG UID=1000
ARG GID=1000
RUN addgroup -g "${GID}" app 2>/dev/null || true \
 && adduser -u "${UID}" -G "$(getent group "${GID}" | cut -d: -f1)" -s /bin/sh -D app 2>/dev/null || true

# O COPY --from=runner acima grava como root. O prerender reescreve
# dist-ssr/template.html a cada execucao (Tarefa 2) e roda como o mesmo
# usuario sem privilegio do `app`/`queue` — sem isso ele morre com EACCES
# antes de sequer falar com a API.
RUN chown -R app:app /srv/render/dist-ssr

ENV COMPOSER_ALLOW_SUPERUSER=1 \
    COMPOSER_MEMORY_LIMIT=-1

WORKDIR /var/www
