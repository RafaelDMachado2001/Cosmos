# syntax=docker/dockerfile:1

# Imagem de desenvolvimento. Existe por um motivo só: criar /app/node_modules
# com o dono correto DENTRO da imagem. O Docker semeia o volume nomeado a partir
# do conteúdo da imagem naquele caminho, então o volume nasce gravável — sem
# isto ele nasce root:root e o `npm ci` falha com EACCES.
FROM node:22-alpine

ARG UID=1000
ARG GID=1000

WORKDIR /app
RUN mkdir -p /app/node_modules && chown -R ${UID}:${GID} /app

USER ${UID}:${GID}
