# syntax=docker/dockerfile:1

FROM node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY . .

ARG VITE_SITE_URL=http://localhost:8080
ENV VITE_SITE_URL=${VITE_SITE_URL}

ARG VITE_API_URL=/
ENV VITE_API_URL=${VITE_API_URL}

RUN npm run build

FROM nginx:1.27-alpine-slim AS web

ARG UID=1000
ARG GID=1000

COPY docker/web/default.conf /etc/nginx/conf.d/default.conf
COPY docker/web/security-headers.conf /etc/nginx/snippets/security-headers.conf
COPY --from=build --chown=${UID}:${GID} /app/dist /opt/site
COPY docker/web/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh \
 && date -u +%Y%m%d%H%M%S > /opt/site/.build-id \
 && chown ${UID}:${GID} /opt/site/.build-id \
 && mkdir -p /srv/site \
 && chown ${UID}:${GID} /srv/site
ENV SITE_DIR=/srv/site
EXPOSE 80
ENTRYPOINT ["/entrypoint.sh"]
CMD ["nginx", "-g", "daemon off;"]
