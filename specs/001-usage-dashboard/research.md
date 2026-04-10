# Research: Usage Dashboard

## 1. Auth0 Authorization Code + PKCE (Browser SPA)

**Decision**: Use `@auth0/auth0-spa-js` via CDN.

**Rationale**: Framework-agnostic vanilla JS SDK. Handles PKCE flow, token caching (in-memory), silent renewal via iframe. CDN available at `cdn.auth0.com/js/auth0-spa-js/2.1/auth0-spa-js.production.js` (also unpkg/jsdelivr). Minimal integration: `createAuth0Client()` → `loginWithRedirect()` → `handleRedirectCallback()` on page load → `getTokenSilently()` for API calls.

**Alternatives considered**:
- Manual PKCE with fetch: too much code, error-prone token management
- `oidc-client-ts`: heavier, designed for generic OIDC, not Auth0-specific

## 2. Charting Library

**Decision**: Chart.js via CDN.

**Rationale**: ~65KB gzipped (vs ECharts ~300KB+). Built-in responsive mode, native line/bar/doughnut charts. Simple API (`new Chart(canvas, config)`). Dark/light theming via `Chart.defaults.color` and `Chart.defaults.borderColor` at runtime. Future Vue migration trivial via `vue-chartjs` thin wrapper.

**Alternatives considered**:
- Apache ECharts: overkill for this dashboard's needs, massive bundle
- uPlot: lightweight but missing pie/doughnut charts

## 3. Static File Serving

**Decision**: `@fastify/static` plugin with wildcard fallback for SPA routing.

**Rationale**: Standard Fastify plugin. Serve from `public/dashboard/` with `/dashboard/` prefix. SPA history fallback via wildcard route `GET /dashboard/*` returning `index.html` (no built-in history-api-fallback in Fastify). `decorateReply: false` to avoid conflicts with proxy response handling.

**Alternatives considered**:
- nginx reverse proxy: adds infra complexity for dev environment
- `fastify-html`: too opinionated for this use case

## 4. Vanilla JS Structure for Future Vue.js Migration

**Decision**: Component-like modules with centralized event-driven state.

**Rationale**: Each UI component as a module exporting `{ mount(el, props), update(props), destroy() }` — maps directly to Vue lifecycle. Centralized state via `EventTarget`-based store (migrates to Pinia). Folder structure: `dashboard/components/`, `dashboard/stores/`, `dashboard/api/` — mirrors Vue project layout.

**Alternatives considered**:
- Web Components: Shadow DOM complexity, awkward with Vue
- lit-html: adds dependency for marginal gain

## 5. New Dependency: @fastify/static

**Decision**: Add `@fastify/static` to `packages/proxy`.

**Rationale**: Only new dependency needed. Already part of the Fastify ecosystem (maintained by Fastify team). Required to serve the dashboard static files. Aligns with constitution's dependency minimalism — one new dep for an entire feature is acceptable.

**Alternatives considered**: Serving via manual `reply.type().send(readFileSync())` — fragile, no caching headers, no mime-type detection.

## 6. New Auth0 Configuration

**Decision**: Require a separate Auth0 SPA application (new `AUTH0_DASHBOARD_CLIENT_ID` env var).

**Rationale**: The existing Auth0 app is configured for Device Authorization Grant (CLI). Browser PKCE requires an SPA app type with callback URLs. Same Auth0 tenant and audience — no new identity provider. The Auth0 free tier supports multiple applications.
