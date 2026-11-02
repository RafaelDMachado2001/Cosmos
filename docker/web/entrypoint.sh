#!/bin/sh
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
