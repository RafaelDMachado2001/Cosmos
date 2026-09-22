#!/bin/sh
# Semeia o volume `site` com o build assado na imagem.
#
# O volume nasce vazio no primeiro boot e o job so grava quando alguem publica:
# sem esta copia o Nginx serviria 404 em tudo ate a primeira publicacao. A marca
# de versao evita recopiar a cada restart e, num deploy, faz a imagem nova
# sobrescrever o que o job havia gravado — que e o comportamento desejado: o job
# regrava por cima depois.
set -e

STAMP="$SITE_DIR/.build-id"
BUILD_ID="$(cat /opt/site/.build-id)"

if [ ! -f "$STAMP" ] || [ "$(cat "$STAMP")" != "$BUILD_ID" ]; then
  echo "entrypoint: semeando $SITE_DIR com o build $BUILD_ID"
  cp -a /opt/site/. "$SITE_DIR/"
fi

exec "$@"
