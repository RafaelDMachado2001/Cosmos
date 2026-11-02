#!/bin/sh
set -e

php artisan env:assert-production

php artisan config:cache
php artisan route:cache
php artisan view:cache

exec docker-php-entrypoint "$@"
