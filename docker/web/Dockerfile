# syntax=docker/dockerfile:1

FROM node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY . .

ARG VITE_SITE_URL=http://localhost:8080
ENV VITE_SITE_URL=${VITE_SITE_URL}

# O bundle de cliente precisa falar com a API, senao serve o acervo semente
# embutido e desfaz, ao montar, o que o job de regeração acabou de gravar.
# Relativo à origem de propósito: vale para qualquer domínio, e é a mesma
# origem que serve /api.
ARG VITE_API_URL=/
ENV VITE_API_URL=${VITE_API_URL}

# build = tsc -b && vite build. A partir da Fase 6 o postbuild do npm dispara
# o prerender no mesmo comando — não acrescentar um segundo RUN.
RUN npm run build

FROM nginx:1.27-alpine-slim AS web

# O mesmo uid do serviço `queue`.
#
# Este container semeia o volume, mas quem escreve nele depois é o job, que roda
# como uid 1000. `cp -a` preserva o dono da origem: sem estes chown o volume
# nasce inteiro como root e a primeira publicação morre com EACCES. O Nginx lê
# como root e não se importa com o dono.
ARG UID=1000
ARG GID=1000

COPY docker/web/default.conf /etc/nginx/conf.d/default.conf
COPY docker/web/security-headers.conf /etc/nginx/snippets/security-headers.conf
COPY --from=build --chown=${UID}:${GID} /app/dist /opt/site
COPY docker/web/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh \
 && date -u +%Y%m%d%H%M%S > /opt/site/.build-id \
 && chown ${UID}:${GID} /opt/site/.build-id \
 # O ponto de montagem também: o Docker semeia o dono do volume a partir dele,
 # e criar arquivo novo na raiz de /srv/site exige permissão neste diretório,
 # não só nos que o `cp` trouxe.
 && mkdir -p /srv/site \
 && chown ${UID}:${GID} /srv/site
ENV SITE_DIR=/srv/site
EXPOSE 80
ENTRYPOINT ["/entrypoint.sh"]
CMD ["nginx", "-g", "daemon off;"]
