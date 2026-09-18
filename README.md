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
- Laravel 11 and PostgreSQL 16 planned for the backend

The backend is not implemented yet. The current application is focused on the frontend experience, content model, routing, rendering strategy, and SEO foundation.

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
- Open Graph metadata;
- `Article` JSON-LD;
- `sitemap.xml`;
- `robots.txt`;
- `404.html`.

The absolute site origin comes from `VITE_SITE_URL` and is embedded into the bundle at build time. Changing the domain therefore requires a new build.

## Content model and navigation
The homepage is designed as a constellation rather than a conventional feed. Publications are positioned in time and space, and filters help narrow the visible set without forcing the user into a separate dashboard-like interface.

The visual metaphor is there to support discovery, not to hide the content. A publication still has a stable URL, server-generated metadata, and a non-WebGL page representation. The experience can be playful at the surface while remaining conventional and dependable underneath.

## Project status
Cosmos is currently a frontend-focused project. The interactive client, the Three.js scene, translated routing, prerendering, and SEO foundation are being developed first.

The planned backend will use Laravel 11 with PostgreSQL 16. It is intended to provide the future content and publishing layer, but it is not part of the current implementation yet.

## Why this project exists
Cosmos is not trying to make a blog harder to use. It is trying to make the act of arriving somewhere feel intentional again.

The project is an exploration of how far a personal publishing space can depart from the standard blog template while preserving the things that matter: readable content, durable links, good metadata, predictable browser behavior, testable domain rules, and a fast enough experience to respect the reader.
