# syntax=docker/dockerfile:1

FROM node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY . .

ARG VITE_SITE_URL=http://localhost:8080
ENV VITE_SITE_URL=${VITE_SITE_URL}

# O bundle de cliente precisa falar com a API, senao serve o acervo semente
# embutido e desfaz, ao montar, o que o job de regeracao acabou de gravar.
# Relativo a origem de proposito: vale para qualquer dominio, e e a mesma
# origem que serve /api.
ARG VITE_API_URL=/
ENV VITE_API_URL=${VITE_API_URL}

# build = tsc -b && vite build. A partir da Fase 6 o postbuild do npm dispara
# o prerender no mesmo comando — não acrescentar um segundo RUN.
RUN npm run build

FROM nginx:1.27-alpine-slim AS web
COPY docker/web/default.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /opt/site
COPY docker/web/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh \
 && date -u +%Y%m%d%H%M%S > /opt/site/.build-id \
 && mkdir -p /srv/site
ENV SITE_DIR=/srv/site
EXPOSE 80
ENTRYPOINT ["/entrypoint.sh"]
CMD ["nginx", "-g", "daemon off;"]
