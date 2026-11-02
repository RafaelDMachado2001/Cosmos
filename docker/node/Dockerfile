# syntax=docker/dockerfile:1

FROM node:22-alpine

ARG UID=1000
ARG GID=1000

WORKDIR /app
RUN mkdir -p /app/node_modules && chown -R ${UID}:${GID} /app

USER ${UID}:${GID}
