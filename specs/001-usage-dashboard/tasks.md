# Tasks: Usage Dashboard

**Input**: Design documents from `/specs/001-usage-dashboard/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/dashboard-api.md, quickstart.md

**Tests**: Vitest tests included for backend API routes (per constitution II: Testing Standards). Frontend is static files — no automated tests in this pass.

**Organization**: Tasks grouped by user story for independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story (US1, US2, US3)
- All paths relative to `packages/proxy/`

---

## Phase 1: Setup

**Purpose**: Project dependencies and directory structure

- [x] T001 Install `@fastify/static` dependency in `packages/proxy/package.json`
- [x] T002 Create directory structure: `packages/proxy/public/dashboard/{css,js/{api,stores,components,utils},assets}`
- [x] T003 Add `AUTH0_DASHBOARD_CLIENT_ID` env var to `packages/proxy/src/config.ts` with Zod validation (required string)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that ALL user stories depend on — API auth, static serving, frontend shell, auth flow

**CRITICAL**: No user story work can begin until this phase is complete

- [x] T004 Register `@fastify/static` plugin in `packages/proxy/src/server.ts` — serve `public/dashboard/` at `/dashboard/` prefix with `decorateReply: false`, add SPA fallback wildcard route `GET /dashboard/*` returning `index.html`
- [x] T005 Add dashboard API auth hook in `packages/proxy/src/server.ts` — reuse existing `authMiddleware` for `/api/dashboard/*` routes (separate from `/v1/*` hook), add admin role check helper for `/api/dashboard/admin/*` returning 403 for non-`tech-lead` users
- [x] T006 Create `packages/proxy/src/routes/dashboard.ts` — register route plugin with `/api/dashboard` prefix, import and wire query service (empty handlers for now, filled per user story)
- [x] T007 [P] Create `packages/proxy/public/dashboard/index.html` — SPA shell with viewport meta, responsive meta tags, CDN links for `@auth0/auth0-spa-js` 2.x and Chart.js 4.x, `<div id="app">`, module script loading `js/app.js`
- [x] T008 [P] Create `packages/proxy/public/dashboard/callback.html` — minimal HTML that loads auth0-spa-js, calls `handleRedirectCallback()`, then redirects to `/dashboard`
- [x] T009 [P] Create `packages/proxy/public/dashboard/css/styles.css` — CSS custom properties for dark/light themes (colors, spacing, typography scale), responsive grid layout with breakpoints at 375px/768px/1280px, card component styles, table styles, utility classes
- [x] T010 [P] Create `packages/proxy/public/dashboard/js/utils/theme.js` — dark/light mode toggle with `localStorage` persistence and `prefers-color-scheme` system preference detection, exports `{ initTheme(), toggleTheme(), getCurrentTheme() }`
- [x] T011 [P] Create `packages/proxy/public/dashboard/js/utils/format.js` — number formatting (1.2M, 45.3K), date formatting (ISO to locale), token count display, exports `{ formatNumber(), formatDate(), formatTokens() }`
- [x] T012 Create `packages/proxy/public/dashboard/js/api/client.js` — fetch wrapper that calls `auth0Client.getTokenSilently()` for JWT, sets `Authorization: Bearer` header, handles 401 (redirect to login), 403 (show forbidden message), parses JSON responses, exports `{ get(path, params) }`
- [x] T013 Create `packages/proxy/public/dashboard/js/stores/state.js` — centralized state store extending `EventTarget`, holds `{ user, period, personalData, adminData, view, loading, error }`, dispatches `'state-changed'` events on mutation, exports `{ store, dispatch(action, payload) }`
- [x] T014 Create `packages/proxy/public/dashboard/js/app.js` — main entry: init Auth0 client with `createAuth0Client({ domain, clientId, authorizationParams })` reading config from a `<meta>` tag or inline config, detect callback URL and handle redirect, check `isAuthenticated()`, redirect to login if not, decode JWT for user role, init state store, mount header component, mount view based on role
- [x] T015 [P] Create `packages/proxy/public/dashboard/js/components/header.js` — nav bar with app title, user email display, role badge, theme toggle button, admin/personal view switcher (hidden for non-admin), logout button. Exports `{ mount(el), update(state), destroy() }`
- [x] T016 [P] Create `packages/proxy/public/dashboard/js/components/empty-state.js` — reusable empty/loading/error state component with icon, message, and optional action button. Exports `{ mount(el, { type, message }), destroy() }`
- [x] T017 [P] Create `packages/proxy/public/dashboard/js/components/date-picker.js` — date range selector with `from`/`to` inputs (type=date), preset buttons (This month, Last 30 days, Last 90 days), max range validation (90 days), dispatches `'period-changed'` event on store. Exports `{ mount(el), update(period), destroy() }`
- [x] T018 Inject Auth0 dashboard config into served HTML — add route in `packages/proxy/src/server.ts` or middleware that injects `AUTH0_DOMAIN`, `AUTH0_DASHBOARD_CLIENT_ID`, `AUTH0_AUDIENCE` as a `<script>` config block into `index.html` (no secrets — these are public SPA params)
- [x] T019 Write Vitest integration test for static file serving and SPA fallback in `packages/proxy/src/__tests__/dashboard-static.test.ts` — verify `GET /dashboard` returns HTML, `GET /dashboard/nonexistent` returns `index.html` (SPA fallback), `GET /api/dashboard/me/summary` without auth returns 401

**Checkpoint**: Foundation ready — Fastify serves dashboard, auth flow works, shared components mounted

---

## Phase 3: User Story 1 — View Personal Token Consumption (Priority: P1) MVP

**Goal**: Authenticated user sees their own token consumption: summary cards, daily breakdown chart, per-model chart, date range filter

**Independent Test**: Log in as any user, verify dashboard displays usage data matching SQLite records for that user. Empty state shown for users with no data.

### Backend — US1

- [x] T020 [P] [US1] Create `packages/proxy/src/services/dashboard-queries.ts` — `DashboardQueries` class taking `better-sqlite3` db instance, implement 3 prepared statements: `getPersonalSummary(userSub, from, to)`, `getPersonalDaily(userSub, from, to)`, `getPersonalModels(userSub, from, to)` per data-model.md query patterns, with Zod schemas for return types
- [x] T021 [P] [US1] Write Vitest unit tests for personal queries in `packages/proxy/src/__tests__/dashboard-queries-personal.test.ts` — use in-memory SQLite, seed with test data, verify aggregation correctness for summary/daily/models, verify empty results for unknown user, verify date range filtering
- [x] T022 [US1] Implement 3 personal API endpoints in `packages/proxy/src/routes/dashboard.ts` — `GET /api/dashboard/me/summary`, `GET /api/dashboard/me/daily`, `GET /api/dashboard/me/models` with Zod validation for `from`/`to` query params (ISO date, max 90 days range), extract `user_sub` from authenticated request, call `DashboardQueries`, return JSON per contracts/dashboard-api.md
- [x] T023 [US1] Write Vitest integration test for personal endpoints in `packages/proxy/src/__tests__/dashboard-routes-personal.test.ts` — inject mock auth (valid JWT with user_sub), seed DB, verify 200 with correct JSON shape, verify 401 without auth, verify 400 for invalid date range

### Frontend — US1

- [x] T024 [P] [US1] Create `packages/proxy/public/dashboard/js/components/summary-cards.js` — 3 cards (Input Tokens, Output Tokens, Request Count) with formatted numbers (using `format.js`), responsive grid (3-column desktop, 1-column mobile), loading skeleton state. Exports `{ mount(el), update(data), destroy() }`
- [x] T025 [P] [US1] Create `packages/proxy/public/dashboard/js/components/daily-chart.js` — Chart.js line chart for daily token breakdown (input + output as stacked areas or separate lines), responsive, dark/light theme aware via CSS custom properties, empty state when no data. Exports `{ mount(el), update(data), destroy() }`
- [x] T026 [P] [US1] Create `packages/proxy/public/dashboard/js/components/model-chart.js` — Chart.js doughnut chart for per-model token distribution, legend with model names and percentages, responsive sizing, empty state. Exports `{ mount(el), update(data), destroy() }`
- [x] T027 [US1] Wire personal view in `packages/proxy/public/dashboard/js/app.js` — on auth success + state init, call `/api/dashboard/me/summary`, `/me/daily`, `/me/models` via `client.js`, feed results into store, mount summary-cards + daily-chart + model-chart + date-picker, bind `'period-changed'` event to refetch and update all components

**Checkpoint**: US1 complete — personal dashboard fully functional. Run `npm test -w packages/proxy` to verify backend. Open `/dashboard` in browser to verify frontend.

---

## Phase 4: User Story 2 — Admin Overview by Role and User (Priority: P2)

**Goal**: Admin (tech-lead) sees aggregated consumption across all users grouped by role, plus a user ranking table. Date range filter applies.

**Independent Test**: Log in as tech-lead, verify admin view shows aggregated data matching sum of all user records. Non-admin users cannot access admin view.

### Backend — US2

- [x] T028 [P] [US2] Add admin queries to `packages/proxy/src/services/dashboard-queries.ts` — `getAdminSummary(from, to)`, `getAdminUsers(from, to, limit)` prepared statements per data-model.md (aggregated by role, user ranking by total tokens)
- [x] T029 [P] [US2] Write Vitest unit tests for admin queries in `packages/proxy/src/__tests__/dashboard-queries-admin.test.ts` — seed multi-user/multi-role data, verify role aggregation totals, verify user ranking order, verify limit parameter
- [x] T030 [US2] Implement 2 admin API endpoints in `packages/proxy/src/routes/dashboard.ts` — `GET /api/dashboard/admin/summary`, `GET /api/dashboard/admin/users` with `limit` query param (default 50, max 100), Zod validation, admin role check (403 for non-tech-lead), return JSON per contracts
- [x] T031 [US2] Write Vitest integration test for admin endpoints in `packages/proxy/src/__tests__/dashboard-routes-admin.test.ts` — verify 200 with admin JWT, verify 403 with non-admin JWT, verify correct aggregation shape, verify `limit` param behavior

### Frontend — US2

- [x] T032 [P] [US2] Create `packages/proxy/public/dashboard/js/components/role-chart.js` — Chart.js horizontal bar chart showing token consumption per role (developer, tech-lead, po), responsive, themed. Exports `{ mount(el), update(data), destroy() }`
- [x] T033 [P] [US2] Create `packages/proxy/public/dashboard/js/components/user-table.js` — responsive data table with columns (Rank, Email, Role, Total Tokens, Input, Output, Requests), sorted by total tokens descending, mobile-friendly card layout below 768px. Exports `{ mount(el), update(data), destroy() }`
- [x] T034 [US2] Wire admin view in `packages/proxy/public/dashboard/js/app.js` — add admin view section (visible when user role is `tech-lead`), view switcher between personal/admin, on admin view mount: call `/api/dashboard/admin/summary` and `/admin/users`, mount role-chart + user-table + admin summary-cards (total across all users), bind date-picker to refetch

**Checkpoint**: US2 complete — admin view functional alongside personal view. Verify role-based access control works.

---

## Phase 5: User Story 3 — Trend Analysis and Export (Priority: P3)

**Goal**: Admin sees daily trend chart over selected period, can export usage data as CSV.

**Independent Test**: Select multi-week range, verify trend chart renders correctly. Click export, verify CSV file content matches displayed data.

### Backend — US3

- [x] T035 [P] [US3] Add trend query to `packages/proxy/src/services/dashboard-queries.ts` — `getAdminTrend(from, to)` prepared statement per data-model.md (daily aggregation with active user count)
- [x] T036 [P] [US3] Add export query to `packages/proxy/src/services/dashboard-queries.ts` — `getExportData(from, to)` returning rows aggregated by (date, user_email, user_role, model) for CSV generation
- [x] T037 [P] [US3] Write Vitest unit tests for trend and export queries in `packages/proxy/src/__tests__/dashboard-queries-export.test.ts` — verify daily trend ordering, verify export row granularity (date+user+model), verify date range boundaries
- [x] T038 [US3] Implement 2 endpoints in `packages/proxy/src/routes/dashboard.ts` — `GET /api/dashboard/admin/trend` (JSON), `GET /api/dashboard/admin/export` (CSV with `Content-Type: text/csv`, `Content-Disposition: attachment; filename=usage-export-{from}-to-{to}.csv`), admin role check
- [x] T039 [US3] Write Vitest integration test for trend and export endpoints in `packages/proxy/src/__tests__/dashboard-routes-export.test.ts` — verify trend JSON shape, verify CSV content-type and body format, verify filename in Content-Disposition header

### Frontend — US3

- [x] T040 [P] [US3] Create `packages/proxy/public/dashboard/js/components/trend-chart.js` — Chart.js line chart with daily token consumption + active users as secondary Y-axis, responsive, themed. Exports `{ mount(el), update(data), destroy() }`
- [x] T041 [US3] Wire trend chart and export button in admin view in `packages/proxy/public/dashboard/js/app.js` — add trend-chart component to admin view, add "Export CSV" button that calls `/api/dashboard/admin/export` with current date range and triggers browser download via `Blob` + `URL.createObjectURL`

**Checkpoint**: US3 complete — all 3 user stories functional. Full dashboard feature complete.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Edge cases, error handling, visual refinement, responsive testing

- [x] T042 [P] Add error boundary handling in `packages/proxy/public/dashboard/js/app.js` — catch API errors, display error state component, handle auth token expiry (silent renewal failure → redirect to login)
- [x] T043 [P] Add loading states to all data-fetching operations in `packages/proxy/public/dashboard/js/app.js` — show skeleton/spinner via empty-state component during API calls, prevent double-fetch on rapid date picker changes (debounce)
- [x] T044 [P] Add Auth0 PKCE error callback handling in `packages/proxy/public/dashboard/callback.html` — detect `error` query param from Auth0, display user-friendly error message, provide retry link
- [x] T045 Responsive testing pass on `packages/proxy/public/dashboard/css/styles.css` — verify card grid, chart sizing, table→card transform, header collapse, and date picker layout at 375px, 768px, and 1280px breakpoints
- [x] T046 [P] Update `packages/proxy/README.md` or add inline comments — document new `/dashboard` and `/api/dashboard/*` routes, `AUTH0_DASHBOARD_CLIENT_ID` env var, Auth0 SPA setup steps
- [x] T047 Run full Vitest suite (`npm test -w packages/proxy`) and verify all existing proxy tests still pass alongside new dashboard tests

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately
- **Phase 2 (Foundational)**: Depends on Phase 1 — BLOCKS all user stories
- **Phase 3 (US1 P1)**: Depends on Phase 2 — MVP milestone
- **Phase 4 (US2 P2)**: Depends on Phase 2 + T020 (shared query service created in US1)
- **Phase 5 (US3 P3)**: Depends on Phase 2 + T020 (shared query service) + T034 (admin view wiring from US2)
- **Phase 6 (Polish)**: Depends on all desired user stories being complete

### User Story Dependencies

- **US1 (P1)**: Can start after Phase 2 — fully independent, creates shared query service
- **US2 (P2)**: Can start after Phase 2 — adds to query service (T020) and app.js, needs US1's query service file to exist
- **US3 (P3)**: Depends on US2's admin view wiring (T034) — adds trend and export to existing admin section

### Within Each User Story

- Backend queries (T0xx [P]) and tests can run in parallel
- API endpoints depend on query service
- Frontend components ([P]) can be built in parallel
- View wiring depends on all components + API endpoints

### Parallel Opportunities

**Phase 2** — 5 parallel tracks:
```
T007 (index.html) ║ T008 (callback.html) ║ T009 (styles.css) ║ T010 (theme.js) ║ T011 (format.js)
```

**US1** — 2 parallel backend + 3 parallel frontend:
```
Backend: T020 (queries) ║ T021 (tests)
Frontend: T024 (summary-cards) ║ T025 (daily-chart) ║ T026 (model-chart)
```

**US2** — 2 parallel backend + 2 parallel frontend:
```
Backend: T028 (queries) ║ T029 (tests)
Frontend: T032 (role-chart) ║ T033 (user-table)
```

**US3** — 3 parallel backend:
```
Backend: T035 (trend query) ║ T036 (export query) ║ T037 (tests)
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001–T003)
2. Complete Phase 2: Foundational (T004–T019)
3. Complete Phase 3: User Story 1 (T020–T027)
4. **STOP and VALIDATE**: `npm test -w packages/proxy`, open `/dashboard` in browser
5. Deploy/demo if ready — personal dashboard delivers immediate value

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. Add US1 → Test → Deploy (MVP — every user sees their own usage)
3. Add US2 → Test → Deploy (Admin visibility — enterprise value)
4. Add US3 → Test → Deploy (Export + trends — reporting value)
5. Polish → Final deploy

### Parallel Team Strategy

With 2 developers after Phase 2:
- Dev A: US1 backend (T020–T023) then US1 frontend (T024–T027)
- Dev B: US2 backend (T028–T031) then starts US2 frontend once T020 exists
- Both converge on US3 and Polish

---

## Notes

- [P] tasks = different files, no dependencies on incomplete tasks
- [Story] label traces each task to its user story
- Backend tests use in-memory SQLite — no external dependencies
- Frontend has no automated tests — manual browser testing per checkpoint
- All CSS uses custom properties — dark/light mode is a theme variable swap
- Component modules export `{ mount, update, destroy }` for future Vue.js migration
