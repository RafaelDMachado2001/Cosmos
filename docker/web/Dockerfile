# syntax=docker/dockerfile:1

FROM node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY . .

ARG VITE_SITE_URL=http://localhost:8080
ENV VITE_SITE_URL=${VITE_SITE_URL}

# build = tsc -b && vite build. A partir da Fase 6 o postbuild do npm dispara
# o prerender no mesmo comando — não acrescentar um segundo RUN.
RUN npm run build

FROM nginx:1.27-alpine-slim AS web
COPY docker/web/default.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
