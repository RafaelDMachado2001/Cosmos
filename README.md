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
- Run the whole system as one person, for close to nothing a month.

## Stack
**Site:** React 18, TypeScript, Vite, Three.js (used directly, without React Three Fiber), CSS Modules and CSS custom properties for the design tokens.

**Backend:** Laravel 13, Filament 5 for the admin panel, a React editor (the RDM Studio), Laravel Sanctum and Socialite for reader accounts, PostgreSQL.

**Infrastructure:** Vercel for the site, Google Cloud Run (São Paulo) for the backend, Neon for Postgres, Cloudflare for DNS, the edge Worker and R2 media storage, Terraform for all of it, and GitHub Actions for delivery.

Laravel 13 rather than 11: every Laravel 11 release still available carries open security advisories, and Composer refuses to install them. Filament 3 does not run on Laravel 13, hence Filament 5.

## System overview

```mermaid
flowchart LR
    reader([Reader]) --> site
    author([Author]) --> worker
    member([Member]) -.-> worker

    subgraph vercel["Vercel"]
        site[Static site<br/>prerendered HTML]
    end

    worker{{Cloudflare Worker}}

    subgraph run["Cloud Run · São Paulo"]
        api[Public API<br/>api.rdmlabs.com.br]
        admin[Admin and RDM Studio<br/>admin.rdmlabs.com.br]
    end

    db[(Neon Postgres)]
    media[(Cloudflare R2)]
    cron[Cloud Scheduler]

    site -- fetch --> worker
    worker --> api
    worker --> admin
    api --- db
    admin --- db
    admin -- uploads --> media
    site -- images --> media
    admin -- deploy hook --> site
    site -. build reads content .-> api
    cron -- every 15 min --> worker
```

The system is split along the line that matters most here: who is waiting. Readers get static files from a CDN, with no backend in the request path. The backend only serves the author, the build that regenerates the site, and, later, signed-in readers. If the backend goes down, the site keeps reading; only writing stops.

The two halves share one thing, a JSON API, and the site's build reads it through the same adapter the browser uses.

## The site

### Rendering
Cosmos deliberately avoids an animation library. Motion is implemented with exponential damping (`damp`) and CSS keyframes. This keeps the animation model small and explicit, while making it easier to control what runs every frame.

The main performance rule is:
> Nothing that changes every frame passes through React.

Continuous interaction state—such as entering the scene, panning, and zooming—is stored in mutable refs. A single `requestAnimationFrame` loop reads those values and writes directly to DOM transforms and Three.js uniforms. React is reserved for discrete state changes, such as navigation, selection, and page transitions.

The constellation itself is HTML positioned by transform, never canvas, so every star is a real link that can be focused and crawled. A star's position is derived from its date and a hash of its slug and is never stored: publishing something new never moves what is already in the sky.

### Code layout
The codebase is organized around boundaries rather than visual screens.

- **`src/core/`** is pure TypeScript: temporal positioning, the camera, the navigation state machine, filters, routes, SEO headers, the Markdown parser and syntax highlighting. It has no DOM, React or Three.js dependencies, and most of the test suite lives here.
- **`src/prerender/`** runs in Node after the client build and writes one HTML document per route. It renders `HomePage` or `ArticlePage`, not the WebGL constellation, so crawlers and users without JavaScript get a meaningful document. Once React mounts, it takes over.
- **`src/three/`** holds the WebGL scene in its own class with its own loop. It receives only the values it needs to update objects and shader uniforms.
- **`src/components/`** keeps each component next to its CSS Module.
- **`src/styles/tokens.css`** is the single source of truth for colors. The scene reads the same values through `getComputedStyle`, so the interface and the shaders cannot drift into different palettes.
- **`src/i18n/`**: `pt.ts` defines the translation keys and `en.ts` is typed against it, so a missing translation fails type checking instead of rendering an empty string.

### Routing and SEO
Every publication has a real, translated URL:

```text
/pt/publicacoes/{slug}
/en/publications/{slug}
```

`src/core/routing.ts` owns this map, so the client, the prerender, the links and the sitemap cannot develop separate ideas of the URL structure. Crossing the two (`/pt/publications/…`) is a real 404, not a second address for the same article.

Opening a publication from the constellation pushes a history entry. Closing it with `×`, Escape or the browser's Back button follows the same model, so arriving directly and arriving through the sky behave the same way.

Each build writes, per route, the title and description, the canonical URL, `hreflang` for both languages, Open Graph tags with a 1200×630 card drawn from the real design tokens, and JSON-LD. It also writes the sitemap, `robots.txt`, an RSS feed per language and the 404 page.

### Reading content
The body of a publication is Markdown, limited on purpose to headings, paragraphs, quotes, lists, code, images and inline formatting. The parser is written by hand, produces a tree and never an HTML string, and `ArticleBody` is the only component that draws it. React escapes every piece of text; the one remaining injection vector, URLs, is allowlisted by protocol. Syntax highlighting follows the same rule: tokens, never markup.

### The constellation as a navigation model
The homepage is designed as a constellation rather than a feed. Publications are placed in time and space, and filters narrow the visible set without pushing the reader into a dashboard.

The metaphor supports discovery; it does not hide the content. A full, non-virtualized index of the archive exists as plain links for screen readers, and keyboard focus moves the camera to the star being focused.

## The backend

### A modular monolith
The Laravel app is one deployable unit, divided into modules with explicit boundaries:

| Module | Owns |
|---|---|
| Content | Publications, drafts, media, the RDM Studio |
| Identity | Reader accounts, social sign-in, profiles, data export and deletion |
| Activity | An append-only log of readers' domain actions |

Modules talk through domain events and interfaces, never by reading each other's tables. Deptrac enforces this in CI: a module may import another's events and contracts and nothing else, and the shared platform code depends on no module. Comments, sharing and gamification are planned as further modules on the same rules.

### Writing and publishing
The author writes in the RDM Studio, a React editor at `/admin/studio`, with autosave, scheduling and a live preview drawn by the same `ArticleBody` the site uses. Drafts are stored as structured blocks; publishing serializes them to Markdown. The serializer guarantees fidelity: every block of the draft comes back from the site's parser as exactly one block of the same type and content, and the test suite proves it case by case.

Publishing does not deploy anything by itself. It marks the site as dirty:

1. Each save calls `SiteRebuild::request()`, the only path that regenerates the site.
2. In production that triggers a Vercel deploy hook at most once a minute, after the response is sent. Ten quick edits cost one build, not ten.
3. Cloud Scheduler calls an internal endpoint every 15 minutes, signed with an OIDC token that the app verifies. The tick publishes scheduled posts and sends any rebuild still pending.
4. The Vercel build reads every publication from the API and swaps the whole site atomically.

Locally, the same request runs the prerender in a queue worker and writes into the volume Nginx serves, with atomic writes and pruning by difference. The two paths differ by one environment variable, not by code.

A truncated archive from the API makes the build fail instead of publishing half the site.

### Reader accounts
Readers will be able to sign in with Google or GitHub. The backend for this is done; the interface on the site comes next.

- An account is linked to the provider's user id, never to the e-mail, which can change. A second provider joins the same account only when both declared the same verified e-mail.
- After the provider, the reader returns to the page they came from. The return path must be a path on the site: any other host falls back to the home page, so the callback is never an open redirect.
- The site talks to the API with Laravel Sanctum in SPA mode: an HttpOnly session cookie with CSRF protection, and no token in `localStorage`. Sanctum only accepts the reader guard, so the admin's session never authenticates the site's API.
- CORS has two policies. The account routes allow credentials and exactly one origin, the site. The public read API allows any origin and no credentials.
- The prerendered HTML stays anonymous and identical for everyone; the session only exists in the browser.

Privacy is part of the model rather than a later addition. Deleting an account removes the linked identities and anonymizes the member in one transaction, keeping the row so aggregate numbers do not shift. The export gathers the profile and whatever each module stores, through an interface the Identity module publishes without knowing who implements it. The activity log refuses `UPDATE` and `DELETE` at the database level, with a trigger; the only exception is that deletion, which may rewrite an entry's payload and nothing else.

## Infrastructure and delivery

### Two hosts, one app
The admin and the API run in the same container on two hosts. The admin's session cookie is bound to `admin.rdmlabs.com.br` alone; the reader's is shared with the site's domain. A middleware assigns each request to its host and answers 404 to anything that belongs to the other one.

### The edge
Cloud Run cannot map a custom domain in São Paulo, and the Google load balancer that would do it has a fixed monthly cost. A small Cloudflare Worker does the same job: it receives `api.` and `admin.`, forwards to the service's `run.app` address with the original host, the client IP Cloudflare saw and a shared secret. The app answers 404 to anything without the secret, so the `run.app` address is not a back door.

### Deployment
GitHub Actions deploys the backend after CI passes on `main`, authenticating to Google through Workload Identity Federation, with no stored keys. It builds the production image (FrankenPHP, PHP and the web server in one process), runs migrations as a one-off Cloud Run job, and only then moves traffic to the new revision. If migrations fail, the previous revision keeps serving.

The production image refuses to start when a setting is missing: a debug flag left on, local disk for media, a missing edge secret. A broken revision never passes its health check.

Everything is described in Terraform: Cloud Run, the scheduler, the secrets, identity federation, the R2 bucket, the Worker and DNS. Secret values never pass through Terraform state, except the edge secret it generates itself.

### Cost
At this scale the whole system costs about US$ 0.30 a month, all of it Secret Manager. Everything else is billed per use and stays in a free tier. Some numbers were tuned for that: the scheduler runs every 15 minutes rather than every minute, because each tick wakes the database and a one-minute tick would keep it awake around the clock.

## Quality
Every pull request runs:

- **frontend**: environment check, typecheck, lint, about 590 Vitest tests (including the shell in jsdom and a 500/1000-publication scale budget) and the build with prerender;
- **backend**: Pint, PHPStan at level 8 with no baseline, Deptrac, and the suite against a real Postgres, twice: once as in development and once with the connection settings production needs;
- **e2e**: Playwright against the build served by the real Nginx, including a CSP check that fails on any violation;
- **integration**: the full stack. Publishing makes the article answer 200 from disk and deleting it brings back a 404; a seeded admin session drives the RDM Studio through writing, publishing, reading and unpublishing;
- **production image**: the real image refuses an incomplete configuration, and each host answers only what belongs to it;
- **infrastructure**: Terraform formatting and validation, and the edge Worker's tests.

The backend suite refuses to run unless the database name ends in `_test`. That guard exists because it once mattered.

## Project status
Implemented: the interactive site and the Three.js scene, translated routing, prerendering and SEO, the API, the admin panel and the RDM Studio, live publishing, the production infrastructure, and the backend for reader accounts.

Next: the reader sign-in interface and the privacy page, then comments and sharing, monitoring before opening to the public, and gamification as a projection over the activity log.

A longer write-up of the architecture and its trade-offs is in [`docs/architecture.md`](docs/architecture.md). Designs and implementation plans live in `docs/superpowers/`.

## Why this project exists
Cosmos is not trying to make a blog harder to use. It is trying to make the act of arriving somewhere feel intentional again.

The project is an exploration of how far a personal publishing space can depart from the standard blog template while preserving the things that matter: readable content, durable links, good metadata, predictable browser behavior, testable domain rules, and a fast enough experience to respect the reader.
