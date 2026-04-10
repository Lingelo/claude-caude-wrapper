# Implementation Plan: Usage Dashboard

**Branch**: `001-usage-dashboard` | **Date**: 2026-04-10 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-usage-dashboard/spec.md`

## Summary

Add a responsive usage dashboard served by the existing Fastify proxy under `/dashboard`. The dashboard displays per-user token consumption (personal view) and aggregated usage by role/user (admin view) with trend charts and CSV export. Built with vanilla HTML/CSS/JS + Chart.js, authenticated via Auth0 PKCE, reading from the existing SQLite `usage_log` table. Structured for future Vue.js migration.

## Technical Context

**Language/Version**: TypeScript 5.7 (API routes), vanilla JS ES2022 (frontend — no build step)
**Primary Dependencies**: Fastify 5.2, `@fastify/static` (new), `@auth0/auth0-spa-js` (CDN), Chart.js 4.x (CDN), better-sqlite3 11.7 (existing)
**Storage**: Existing SQLite `usage_log` table (read-only access, no schema changes)
**Testing**: Vitest (API routes), manual browser testing (frontend)
**Target Platform**: Node.js 22+ server, responsive web (desktop 1280px+, tablet 768px+, mobile 375px+)
**Project Type**: Web dashboard embedded in existing proxy server
**Performance Goals**: Personal summary <3s, admin top-10 <5s, filter update <2s, CSV export <10s (per SC-001–005)
**Constraints**: No framework, no build step, <100 users, 90-day retention boundary, same Auth0 tenant
**Scale/Scope**: <100 users, single SQLite DB, 7 API endpoints + static frontend

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Code Quality | PASS | Strict TS for API routes. Zod validation on query params. ESM imports with `.js` extensions. |
| II. Testing Standards | PASS | Vitest for API route unit/integration tests. Frontend is static files (manual + future e2e). |
| III. UX Consistency | PASS | Silent success, loud failure. Auth flow transparency via Auth0 redirect. |
| IV. Performance | PASS | Aggregation queries only. No raw row fetches. Latency targets defined. |
| V. Transparent Proxy | PASS | Dashboard is additive — no changes to existing proxy forwarding logic. New routes under `/api/dashboard/` and `/dashboard/`, completely separate from `/v1/*`. |
| Security & Reliability | PASS | JWT validation reused. Admin role check on admin endpoints. No secrets in frontend. 90-day retention enforced. |
| Dependency Minimalism | PASS | One new server dependency (`@fastify/static`). Frontend deps via CDN only (no npm install). |
| Workspace Isolation | **WATCH** | Dashboard lives in `packages/proxy` (same server). No CLI changes needed. This is intentional — the dashboard is an extension of the proxy, not a separate package. |

**Post-Phase 1 re-check**: All gates still pass. No new violations introduced by data model or contracts.

## Project Structure

### Documentation (this feature)

```text
specs/001-usage-dashboard/
├── plan.md              # This file
├── spec.md              # Feature specification
├── research.md          # Phase 0: technology decisions
├── data-model.md        # Phase 1: query patterns & data model
├── quickstart.md        # Phase 1: setup & run guide
├── contracts/
│   └── dashboard-api.md # Phase 1: API endpoint contracts
└── tasks.md             # Phase 2 output (created by /speckit.tasks)
```

### Source Code (repository root)

```text
packages/proxy/
├── src/
│   ├── routes/
│   │   └── dashboard.ts         # NEW: dashboard API routes (6 endpoints)
│   ├── services/
│   │   └── dashboard-queries.ts # NEW: SQLite aggregation queries
│   ├── config.ts                # MODIFIED: add AUTH0_DASHBOARD_CLIENT_ID
│   ├── server.ts                # MODIFIED: register static files + dashboard routes
│   └── ... (existing files unchanged)
├── public/
│   └── dashboard/               # NEW: static frontend files
│       ├── index.html           # SPA entry point
│       ├── callback.html        # Auth0 PKCE callback handler
│       ├── css/
│       │   └── styles.css       # Responsive styles, dark/light mode
│       ├── js/
│       │   ├── app.js           # Main entry, router, auth init
│       │   ├── api/
│       │   │   └── client.js    # API client (fetch + JWT injection)
│       │   ├── stores/
│       │   │   └── state.js     # Centralized state (EventTarget-based)
│       │   ├── components/
│       │   │   ├── header.js    # Nav, user info, theme toggle
│       │   │   ├── summary-cards.js    # Token count cards
│       │   │   ├── daily-chart.js      # Daily breakdown (Chart.js line)
│       │   │   ├── model-chart.js      # Per-model breakdown (Chart.js doughnut)
│       │   │   ├── role-chart.js       # Admin: by-role (Chart.js bar)
│       │   │   ├── user-table.js       # Admin: user ranking table
│       │   │   ├── trend-chart.js      # Admin: daily trend (Chart.js line)
│       │   │   ├── date-picker.js      # Date range filter
│       │   │   └── empty-state.js      # Empty/loading/error states
│       │   └── utils/
│       │       ├── format.js    # Number/date formatting
│       │       └── theme.js     # Dark/light mode toggle + persistence
│       └── assets/
│           └── logo.svg         # Optional branding
└── package.json                 # MODIFIED: add @fastify/static dependency
```

**Structure Decision**: Dashboard frontend lives inside `packages/proxy/public/dashboard/` as static files served by the same Fastify process. API routes in `src/routes/dashboard.ts`. This avoids a new workspace, keeps deployment as a single process, and shares auth middleware. The `public/dashboard/js/` folder follows a Vue-like structure (`components/`, `stores/`, `api/`) to ease future migration.

## Complexity Tracking

No constitution violations requiring justification. All gates pass.

## Implementation Phases

### Phase 1: Backend API (P1 foundation)

1. Add `@fastify/static` dependency
2. Create `dashboard-queries.ts` — prepared statements for all 6 query patterns (from data-model.md)
3. Create `routes/dashboard.ts` — 6 API endpoints with Zod query param validation, auth middleware reuse, admin role check
4. Update `config.ts` — add `AUTH0_DASHBOARD_CLIENT_ID` env var
5. Update `server.ts` — register `@fastify/static` for `/dashboard/`, register dashboard API routes, add SPA fallback route
6. Write Vitest tests for `dashboard-queries.ts` (unit, in-memory SQLite) and `routes/dashboard.ts` (integration)

### Phase 2: Frontend — Personal View (P1 user story)

1. Create `index.html` — SPA shell with CDN links (auth0-spa-js, Chart.js), responsive meta tags
2. Create `callback.html` — Auth0 PKCE callback page
3. Implement auth flow (`app.js`) — init Auth0 client, login redirect, token management
4. Implement API client (`api/client.js`) — fetch wrapper with JWT injection
5. Implement state store (`stores/state.js`) — EventTarget-based centralized state
6. Build personal view components: summary-cards, daily-chart, model-chart, date-picker, empty-state
7. Responsive CSS with dark/light mode toggle

### Phase 3: Frontend — Admin View (P2 user story)

1. Add admin view toggle (visible only to tech-lead role)
2. Build admin components: role-chart, user-table, trend-chart
3. Admin summary cards (total across all users)

### Phase 4: Export & Polish (P3 user story)

1. CSV export button (calls `/api/dashboard/admin/export`, triggers browser download)
2. Loading states, error handling, edge cases
3. Visual polish, animations, responsive testing across viewports
