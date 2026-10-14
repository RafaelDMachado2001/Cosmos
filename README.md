# RDM Labs · Cosmos
Cosmos is a personal blog and editorial space about technology, routines, and the small ideas that are easy to lose in the noise of the internet.

Most blogs and online communities tend to converge on the same visual language: a feed, a sidebar, a familiar card layout, and a lot of text competing for attention. Cosmos is an attempt to build something more personal. Its interface treats navigation as part of the reading experience, using a space-inspired 3D environment to connect ideas without turning the content into a gimmick.

The project is being built as an experiment in expressive interfaces: a place where the visual identity, the code architecture, the accessibility of the content, and the performance of the experience all have to coexist.

## Goals
- Create a distinctive reading experience instead of another generic blog layout.
- Make exploration feel spatial while keeping individual publications easy to reach.
- Keep the real content available to crawlers, screen readers, and users without JavaScript.
- Treat performance as an architectural constraint, especially inside the WebGL scene.
- Keep the domain logic independent from React and browser APIs wherever possible.
- Support Portuguese and English from the beginning, with translated routes and metadata.

## Stack
- React 18
- TypeScript
- Vite
- Three.js, used directly without React Three Fiber
- CSS Modules
- CSS custom properties for shared design tokens
- Laravel 13, Filament 5 and PostgreSQL 16 for the API, the admin panel and the publishing queue

Laravel 13 rather than 11: every Laravel 11 release still available carries open security advisories, and Composer refuses to install them. Filament 3 does not run on Laravel 13, hence Filament 5.

## Technical direction
Cosmos deliberately avoids an animation library. Motion is implemented with exponential damping (`damp`) and CSS keyframes. This keeps the animation model small and explicit, while making it easier to control what runs every frame.

The main performance rule is:
> Nothing that changes every frame passes through React.

Continuous interaction state—such as entering the scene, panning, and zooming—is stored in mutable refs. A single `requestAnimationFrame` loop reads those values and writes directly to DOM transforms and Three.js uniforms. React is reserved for discrete state changes, such as navigation, selection, and page transitions.

This separation avoids turning the render tree into a frame-by-frame update mechanism and keeps the responsibilities of the UI and the scene clear.

## Architecture
The codebase is organized around boundaries rather than visual screens:

### `src/core/`
Pure TypeScript domain logic. This layer has no DOM, React, or Three.js dependencies.

It contains temporal positioning, movement coefficients, the navigation state machine, filters, route definitions, and the SEO headers for each page. Most of the test suite lives here because these rules can be tested without a browser or a renderer.

### `src/prerender/`
The build-time rendering step. It runs in Node after the client build, through the npm `postbuild` script, and writes one HTML document for each route.

The generated shell is intentionally not the WebGL constellation. It renders `HomePage` or `ArticlePage`, giving crawlers and users without JavaScript a meaningful document. Once React mounts, it takes over from that shell and initializes the interactive experience.

### `src/three/`
The WebGL scene, implemented in its own class with its own animation loop. The `requestAnimationFrame` lifecycle stays outside React, and the scene receives only the values it needs to update objects and shader uniforms.

### `src/components/`
One directory per component, with the component and its CSS Module kept together. Components handle interface composition and user interaction, while continuous scene updates remain outside React's render cycle.

### `src/styles/tokens.css`
The single source of truth for the visual tokens, especially colors. The Three.js scene reads the same computed CSS values through `getComputedStyle`, so the interface and the shader cannot quietly drift into different palettes.

### `src/i18n/`
`pt.ts` is the source of truth for translation keys. `en.ts` is typed against it, so a missing translation is caught by type checking instead of becoming an empty string at runtime.

## Routing and SEO
Every publication has a real, translated URL:

```text
/pt/publicacoes/{slug}
/en/publications/{slug}
```

`src/core/routing.ts` owns this map. Keeping route recognition in one place prevents the client router, prerenderer, links, and SEO metadata from developing separate interpretations of the same URL structure.

Opening a publication from the constellation pushes a browser history entry. Closing it with the `×` button, pressing Escape, or using the browser Back button follows the same navigation model, so direct navigation and interactive navigation remain consistent.

During the build, `npm run postbuild` generates:
- one HTML file per route;
- a page title and meta description;
- canonical URLs;
- Portuguese and English `hreflang` links;
- Open Graph metadata, including a 1200×630 `og:image` card drawn from the real design tokens;
- `Article` JSON-LD;
- `sitemap.xml`;
- `robots.txt`;
- `404.html`.

The absolute site origin comes from `VITE_SITE_URL` and is embedded into the bundle at build time. Changing the domain therefore requires a new build.

## Content model and navigation
The homepage is designed as a constellation rather than a conventional feed. Publications are positioned in time and space, and filters help narrow the visible set without forcing the user into a separate dashboard-like interface.

The visual metaphor is there to support discovery, not to hide the content. A publication still has a stable URL, server-generated metadata, and a non-WebGL page representation. The experience can be playful at the surface while remaining conventional and dependable underneath.

## Publishing pipeline
Publications are written in the Filament panel at `/admin`. Saving one makes its URL answer 200 with the full text, without rebuilding any image:

1. A model observer dispatches `RegenerateSite` to the database queue. A burst of saves collapses into one job.
2. The `queue` service runs the same prerender the build runs, against the live API, and writes into the `site` volume that Nginx serves. Writes are atomic (temporary file and `rename`), so a reader never gets half an HTML document.
3. Whatever the archive no longer contains is pruned by difference, after everything else is written: an unpublished article goes back to a real 404, and the site never goes dark during the roughly one-minute regeneration.
4. Between saving and the job finishing, Nginx falls back to a minimal Laravel page with `noindex` and logs a warning. Reaching it means the pipeline has not caught up yet.

Two guards keep the pipeline honest. If the API reports a truncated archive (`meta.truncated`), the prerender fails instead of publishing half the site. And if the HTML template references assets that the served volume does not have, the prerender refuses to write anything.

The archive has a single source: `src/data/publications.ts`. `npm run emit:seed` generates the backend seed and `backend/config/publications.php` (locales, categories and search dictionaries) from it.

## Development
Everything runs in Docker; the host's Node is not used.

```sh
docker compose up node                                  # Vite with HMR on :5174
docker compose run --rm node npm run check              # typecheck + lint + tests
docker compose --profile backend up -d db app queue web # API, panel, queue and Nginx on :8080
```

`npm run check:env` compares `.env` and `backend/.env` with their `.env.example` files, and in production also requires `APP_DEBUG=false`, an `APP_KEY`, a database password and an absolute `VITE_SITE_URL`. It runs before `dev`, before `build` and in CI.

## CI and hooks
`.github/workflows/ci.yml` runs four jobs on every pull request and on `main`:

- **frontend** — environment check, typecheck, lint, the whole Vitest suite (including the shell in jsdom and the 500/1000-publication scale budget) and the build with prerender.
- **backend** — Postgres service, `pint --test`, PHPStan level 8 with Larastan and no baseline, and `php artisan test` against a database ending in `_test`.
- **e2e** — Playwright against the build served by the real Nginx: opening a star and going back, a real 404 status, the other locale's segment answering 404, and the article readable without JavaScript.
- **integração** — the full stack with the backend profile. Publishing makes the article URL answer 200 with its text, served from disk; deleting it brings back a 404. This is the job that proves the publishing pipeline.

`.github/workflows/review.yml` asks Claude to review each pull request. It is inert until the repository has an `ANTHROPIC_API_KEY` secret.

Git hooks live in `.githooks` (`git config core.hooksPath .githooks`). `pre-commit` only lints and typechecks when TypeScript changed, and only runs `pint --test` on the PHP files being committed. `pre-push` runs the full `npm run check`.

### Branch protection
Documented here and deliberately not applied: changing repository settings is a decision for whoever administers it. The intended rule for `main`:

- require a pull request before merging, with 1 approval and stale approvals dismissed on new commits;
- require status checks to pass, branches up to date before merging: `frontend`, `backend`, `e2e`, `integração`;
- require linear history;
- do not allow force pushes or deletions;
- apply the rules to administrators as well.

## Project status
The interactive client, the Three.js scene, translated routing, prerendering and SEO, the Laravel API, the Filament panel and live publishing are implemented. Designs and implementation plans live in `docs/superpowers/`.

## Why this project exists
Cosmos is not trying to make a blog harder to use. It is trying to make the act of arriving somewhere feel intentional again.

The project is an exploration of how far a personal publishing space can depart from the standard blog template while preserving the things that matter: readable content, durable links, good metadata, predictable browser behavior, testable domain rules, and a fast enough experience to respect the reader.
