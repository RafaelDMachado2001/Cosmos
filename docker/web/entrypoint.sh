#!/bin/sh
# Semeia o volume `site` com o build assado na imagem.
#
# O volume nasce vazio no primeiro boot e o job só grava quando alguém publica:
# sem esta copia o Nginx serviria 404 em tudo até a primeira publicação. A marca
# de versão evita recopiar a cada restart e, num deploy, faz a imagem nova
# sobrescrever o que o job havia gravado — que é o comportamento desejado: o job
# regrava por cima depois.
set -e

: "${SITE_DIR:?SITE_DIR nao definido}"

STAMP="$SITE_DIR/.seed-complete"
BUILD_ID="$(cat /opt/site/.build-id)"

if [ ! -f "$STAMP" ] || [ "$(cat "$STAMP")" != "$BUILD_ID" ]; then
  echo "entrypoint: semeando $SITE_DIR com o build $BUILD_ID"
  find "$SITE_DIR" -mindepth 1 -delete
  cp -a /opt/site/. "$SITE_DIR/"
  printf '%s' "$BUILD_ID" > "$STAMP"
fi

exec "$@"
