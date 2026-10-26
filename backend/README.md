# Cosmos · backend

The Laravel side of [Cosmos](../README.md): the public JSON API the site is built from, the
admin panel and the RDM Studio editor, reader accounts, and the jobs that regenerate the site
when something is published.

Readers never reach this application. The site is static HTML on a CDN; the backend serves the
author, the build that regenerates the site, and signed-in readers. If it goes down, the site
keeps reading.

## Stack

Laravel 13 on PHP 8.3, PostgreSQL 18, Filament 5 for the admin, Laravel Sanctum (SPA mode) and
Socialite for reader accounts. In production it runs as a single FrankenPHP container on Cloud
Run; locally, under Docker Compose with Nginx and PHP-FPM.

## Layout

| Path | What lives there |
|---|---|
| `app/Modules/Content/` | Publications, translations, drafts, media, the RDM Studio, site regeneration |
| `app/Modules/Identity/` | Reader accounts, Google and GitHub sign-in, profile, data export and deletion |
| `app/Modules/Activity/` | The append-only log of readers' domain actions |
| `app/Http/Middleware/` | Platform concerns shared by every module: host boundary, edge verification, CORS, security headers |
| `app/Filament/` | The admin panel and its Google sign-in, restricted to one allowlisted address |
| `config/publications.php` | Locales, categories and search dictionaries, **generated** from `src/core/types.ts` |
| `database/seeders/publications.json` | The seed archive, **generated** from `src/data/publications.ts` |
| `deptrac.yaml` | The module boundaries, checked in CI |

A module may import another module's events (`Identity/Events`) and contracts
(`Identity/Contracts`), and nothing else. Platform code depends on no module. Deptrac fails the
build on any other import.

## Running it

Everything runs in Docker from the repository root; PHP is not needed on the host.

```sh
docker compose --profile backend up -d db app queue scheduler web   # API, admin and Nginx on :8080
docker compose --profile backend exec app php artisan migrate --seed
```

The admin lives at `http://localhost:8080/admin`, the editor at `/admin/studio` (built with
`npm run build:admin` from the root).

## Checks

The same commands CI runs:

```sh
docker compose --profile backend exec -T app ./vendor/bin/pint --test
docker compose --profile backend exec -T app ./vendor/bin/phpstan analyse --memory-limit=1G   # level 8
docker compose --profile backend exec -T app ./vendor/bin/deptrac analyse
docker compose --profile backend exec -T app php artisan test
```

The suite runs against a real PostgreSQL, because search depends on generated `tsvector`
columns with the `portuguese` and `english` dictionaries. `tests/TestCase.php` refuses to run
unless the database name ends in `_test`, so `RefreshDatabase` can never wipe the development
database.

## Production

Production differs from Compose by environment variables, never by code. The variables that
only exist in production are documented in `.env.production.example`, and the image refuses to
start when one of them is missing (`php artisan env:assert-production`). The infrastructure and
the cut-over steps are in [`infra/README.md`](../infra/README.md); the trade-offs, in
[`docs/architecture.md`](../docs/architecture.md).
