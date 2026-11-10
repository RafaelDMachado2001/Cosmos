# Cosmos

My personal blog, built as an interactive 3D star map. Each post is a star, placed in the sky by its publication date. Available in Portuguese and English.

**Live:** [cosmos.rdmlabs.com.br](https://cosmos.rdmlabs.com.br) · **Architecture:** [docs/architecture.md](docs/architecture.md)

<!-- TODO: Add a short GIF showing the constellation, navigation and opening an article -->
<!-- ![Exploring the Cosmos constellation](docs/media/cosmos.gif) -->

## What is Cosmos?

Cosmos is where I publish articles, study notes, projects and occasional posts about everyday life (and coffee).

I wanted to build something different from the usual blog layout. Instead of a feed or a grid of cards, the home page is an interactive universe where each article becomes a star.

The visual experience is just one part of the idea. Every star links to a regular article page, with its own URL in Portuguese and English. The archive is also available as static HTML, making the content accessible to search engines, screen readers and visitors browsing without JavaScript.

Cosmos is both a place to share what I learn and a project where I can explore software engineering beyond my everyday work.

## Highlights

- **Interactive 3D experience:** an explorable star map built with Three.js.
- **Bilingual publishing:** articles and routes available in Portuguese and English.
- **Custom article editor:** RDM Studio, a React-based editor with support for diagrams and flowcharts.
- **Custom Markdown parser:** a handwritten parser that keeps the editor preview, prerendering and reading experience consistent.
- **Static publishing:** articles are prerendered as HTML and served through a CDN.
- **Production-ready infrastructure:** automated deployment, SEO, security checks and end-to-end testing.

## Architecture at a glance

The main architectural decision was to separate the reading experience from the publishing system.

Readers receive static HTML through a CDN. The backend handles content management, the editor and site generation. This means the public reading experience does not depend on the backend being available.

A few other decisions shape the project:

- **Shared domain logic:** core functionality lives in plain TypeScript, independently of React and Three.js. The browser, prerendering process and editor preview reuse the same code.
- **One parser, one renderer:** content is stored in a small Markdown subset and rendered through a shared component. No HTML strings are passed between these layers.
- **Deterministic star positions:** each star's position is calculated from its publication date and slug, so publishing a new article does not rearrange the existing constellation.

For the full architecture, rendering pipeline, publishing flow and infrastructure decisions, see [the architecture write-up](docs/architecture.md).

## Tech stack

| Layer | Technologies |
|---|---|
| Frontend | React 18, TypeScript, Vite, Three.js, CSS Modules |
| Backend | PHP, Laravel 13, Filament 5 |
| Database | PostgreSQL 18 |
| Development | Docker, Docker Compose |
| Infrastructure | Google Cloud Run, Vercel, Cloudflare, Neon, Terraform, GitHub Actions |

Other notable parts include RDM Studio, the custom Markdown parser, Vitest, Playwright, PHPStan and Deptrac.

## Running locally

The development environment uses Docker Compose v2, so Node.js and PHP do not need to be installed on your machine.

```sh
# Start the frontend with hot reload
docker compose up node

# Run frontend checks and tests
docker compose run --rm node npm run check

# Start the backend services
docker compose --profile backend up -d db app queue scheduler web
```

The frontend runs at `http://localhost:5174`. The backend services are available at `http://localhost:8080`.

The frontend can also run without the backend, using a seeded archive bundled with the code.

## Quality and testing

Quality checks are part of the development workflow and run on every pull request.

- **Frontend:** typechecking, linting, approximately 650 Vitest tests and a production build with prerendering.
- **Backend:** Pint, PHPStan level 8, Deptrac and approximately 190 tests against PostgreSQL.
- **End-to-end:** Playwright tests against the production build served by Nginx, including Content Security Policy checks.
- **Integration:** full-stack tests covering publishing, reading, unpublishing and the editor workflow.
- **Infrastructure:** Terraform validation and tests for the Cloudflare Worker.

## Project status

**Implemented**
- Interactive 3D constellation and article navigation.
- Portuguese and English routing.
- Static rendering and SEO.
- Content API, admin panel and RDM Studio.
- Publishing pipeline and production infrastructure.
- Reading experience with themes for different content categories.
- Backend foundation for reader accounts.
- Reader sign-in interface and privacy page.
- Comments and article sharing.
- Smooth scroll

**Next**
- Monitoring before opening reader accounts to the public.
- Fix mobile layout
- New saga about ([Nina](https://github.com/RafaelDMachado2001/nina)
- Full API-based communication for articles
- RDM Studio own project

## Trade-offs

A few decisions were made deliberately, with their limitations in mind:

- **Custom Markdown parser:** it keeps the editor, prerendering and reading experience consistent, but every new block type requires changes across the parser, serializer, renderer and tests.
- **Cloudflare Worker:** used instead of Google's load balancer to route traffic to Cloud Run in São Paulo without adding a fixed monthly infrastructure cost. It does, however, introduce another component to maintain.
- **Scheduled publishing:** a 15-minute scheduler avoids keeping the database awake continuously. The trade-off is that scheduled posts can go live up to 15 minutes late.

## Author

Built by **Rafael Dorneles Machado**, full stack software engineer focused on PHP/Laravel and React.

[Portfolio](https://portfolio.rdmlabs.com.br) · [LinkedIn](https://www.linkedin.com/in/rafael-dorneles-machado-8478b3172) · [Laravel internals series (PT)](https://cosmos.rdmlabs.com.br/pt/publicacoes/marco-zero-laravel-antes-do-primeiro-comando)

---

**Want to go deeper?** The [architecture write-up](docs/architecture.md) covers the rendering loop, routing and SEO, content parsing, modular monolith boundaries, publishing pipeline, reader accounts, edge routing, deployment and infrastructure costs.
