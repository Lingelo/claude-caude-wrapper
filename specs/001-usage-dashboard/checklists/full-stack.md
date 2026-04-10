# Full-Stack Requirements Quality Checklist: Usage Dashboard

**Purpose**: Validate requirements completeness, clarity, and consistency across security, API, UX, and data concerns — reviewer gate before task generation and implementation.
**Created**: 2026-04-10
**Feature**: [spec.md](../spec.md)
**Depth**: Reviewer gate (formal)
**Audience**: Reviewer (PR / pre-implementation)

## Requirement Completeness

- [ ] CHK001 - Are requirements defined for what happens when the Auth0 PKCE token expires mid-session (silent renewal failure, iframe blocked by browser)? [Gap, FR-001]
- [ ] CHK002 - Are requirements defined for the Auth0 SPA application setup (callback URLs, logout URLs, allowed origins) or is this left to the quickstart only? [Completeness, FR-001]
- [ ] CHK003 - Is the behavior specified when a non-admin user directly navigates to an admin URL (e.g., `/dashboard/admin`)? [Gap, FR-010]
- [ ] CHK004 - Are requirements defined for how `cache_creation_input_tokens` and `cache_read_input_tokens` are displayed — are they shown separately, folded into input tokens, or omitted? [Gap, FR-002]
- [ ] CHK005 - Are loading state requirements defined for each dashboard view (skeleton screens, spinners, progressive rendering)? [Gap]
- [ ] CHK006 - Is the refresh mechanism specified — manual refresh button, pull-to-refresh on mobile, or page reload only? [Gap, Assumption §7]
- [ ] CHK007 - Are requirements defined for the dashboard behavior when the proxy SQLite database file is locked by a concurrent write (WAL mode notwithstanding)? [Gap, FR-011]

## Requirement Clarity

- [ ] CHK008 - Is "sleek, modern visual design" in FR-013 quantified beyond "clean typography, generous whitespace"? Are specific design tokens (font families, color palettes, spacing scale) specified? [Clarity, FR-013]
- [ ] CHK009 - Is "designated admin role" in FR-010 unambiguous — is it exclusively `tech-lead`, or can other roles be configured as admin? The spec uses both "tech-lead or designated admin role" and "tech-lead maps to admin privileges" inconsistently. [Ambiguity, FR-010 vs Assumption §5]
- [ ] CHK010 - Is the "current month" default for date range (FR-007) defined precisely — calendar month start to today, or rolling 30 days? [Clarity, FR-007]
- [ ] CHK011 - Is "total request count" in FR-002 defined — all requests including errors, or only successful (status_code=200) requests? [Clarity, FR-002]
- [ ] CHK012 - Is SC-004 ("90% of users can locate their daily breakdown on first visit") measurable without a usability study? Should it be replaced with a structural requirement? [Measurability, SC-004]

## Requirement Consistency

- [ ] CHK013 - FR-014 specifies "Chart.js or ECharts" but research.md decided Chart.js. Is FR-014 updated to reflect the final decision, or is the choice intentionally left open? [Consistency, FR-014 vs research.md]
- [ ] CHK014 - The spec says "mobile-responsive design is out of scope for v1" was replaced by "MUST be responsive and mobile-ready from v1" — are all downstream references (SC-006, acceptance scenarios) updated consistently? [Consistency, Clarification vs SC-006]
- [ ] CHK015 - The API contract defines 7 endpoints (including export) but the plan references "6 API endpoints" — which count is correct? [Conflict, plan.md §Technical Context vs contracts/dashboard-api.md]
- [ ] CHK016 - FR-007 states "maximum: 90 days per retention policy" but the API contract says "Date range is clamped to 90 days maximum" — are these the same constraint or two different ones (retention purge vs query limit)? [Ambiguity, FR-007 vs FR-012]

## Security Requirements Quality

- [ ] CHK017 - Are requirements defined for preventing horizontal privilege escalation — can a user craft API requests to access another user's `/me/*` data by manipulating parameters? [Gap, SC-007]
- [ ] CHK018 - Are CSRF protection requirements specified for the dashboard API endpoints? [Gap, FR-001]
- [ ] CHK019 - Are requirements defined for what user-identifiable data appears in browser network tab, local storage, or console logs? SC-007 covers the UI but not developer tools. [Gap, SC-007]
- [ ] CHK020 - Is the JWT audience validation requirement explicit — does the dashboard API validate `aud` matches the expected Auth0 audience, or could a token from a different Auth0 application be accepted? [Clarity, FR-001]
- [ ] CHK021 - Are Content Security Policy (CSP) requirements defined for the dashboard HTML pages, especially given CDN script loading (auth0-spa-js, Chart.js)? [Gap]
- [ ] CHK022 - Are requirements specified for the Auth0 callback URL validation — what happens if the callback receives an error parameter (e.g., `error=access_denied`)? [Gap, FR-001]

## API Contract Quality

- [ ] CHK023 - Are pagination requirements defined for `/admin/users` beyond `limit`? What if there are more users than the limit — is offset/cursor pagination needed? [Gap, contracts/dashboard-api.md §admin/users]
- [ ] CHK024 - Is the date format for `from`/`to` query parameters precisely specified — ISO date only (`2026-04-10`) or ISO datetime (`2026-04-10T00:00:00Z`)? How are timezone boundaries handled? [Clarity, contracts/dashboard-api.md §Common Parameters]
- [ ] CHK025 - Are requirements defined for API rate limiting on dashboard endpoints, or are they excluded from the proxy's existing `RATE_LIMIT_RPM`? [Gap]
- [ ] CHK026 - Is the error response format for invalid `from`/`to` values (e.g., `from` > `to`, non-date strings, future dates) specified? Only "exceeds 90 days" is covered. [Completeness, contracts/dashboard-api.md §Error Responses]
- [ ] CHK027 - Are caching headers (Cache-Control, ETag) specified for API responses? Dashboard data is point-in-time — can responses be cached briefly? [Gap]
- [ ] CHK028 - Is the CSV export filename format specified (e.g., `usage-export-2026-03-01-to-2026-04-01.csv`)? [Gap, FR-009]

## Scenario Coverage

- [ ] CHK029 - Are requirements defined for what the personal view shows when the authenticated user has a role not in the known set (neither developer, tech-lead, nor po — e.g., `default` role from the schema)? [Coverage, Key Entities §Role]
- [ ] CHK030 - Are requirements defined for dashboard behavior during proxy restart or shutdown — does the SPA handle API unavailability gracefully? [Coverage, Edge Case]
- [ ] CHK031 - Are requirements defined for concurrent admin users viewing the dashboard — any consistency concerns if data changes between requests? [Coverage]
- [ ] CHK032 - Are requirements defined for the transition between personal and admin views — is it a tab, a route change, or a separate page? [Gap, FR-005]
- [ ] CHK033 - Are requirements specified for browser back/forward navigation within the SPA dashboard? [Gap]

## Edge Case Coverage

- [ ] CHK034 - Are requirements defined for date range behavior at retention boundary — if a user selects "last 90 days" but some records have already been purged, is the available range communicated? [Edge Case, FR-012]
- [ ] CHK035 - Are requirements defined for what happens when the usage_log table has records with NULL or unexpected values in session_id, request_duration_ms, or error_message? [Edge Case, data-model.md]
- [ ] CHK036 - Are requirements defined for chart rendering when there is only one data point (single day, single model)? [Edge Case, FR-003/FR-004]
- [ ] CHK037 - Are requirements defined for extremely large token counts in display — number formatting (1.2M vs 1,234,567), overflow in card layouts? [Edge Case, FR-002]

## Non-Functional Requirements

- [ ] CHK038 - Are accessibility requirements specified beyond responsive layout — ARIA labels for charts, keyboard navigation for date pickers, screen reader support for data tables? [Gap, SC-006]
- [ ] CHK039 - Is the dark/light mode toggle requirement (FR-013) specified with persistence behavior — localStorage, system preference, or session-only? [Clarity, FR-013]
- [ ] CHK040 - Are performance requirements defined for the initial page load (time to interactive) separately from API response times (SC-001–005)? CDN assets, auth redirect, and initial API calls all contribute. [Gap]
- [ ] CHK041 - Are browser compatibility requirements specified — minimum browser versions, or just "modern browsers"? [Gap, SC-006]

## Dependencies & Assumptions

- [ ] CHK042 - Is the assumption that "Auth0 free tier supports multiple applications" validated? If the team is on a paid plan, is this a non-issue — but if free tier, is there a limit? [Assumption, research.md §6]
- [ ] CHK043 - Is the assumption that the existing auth middleware can be reused for `/api/dashboard/*` routes validated — does the current `onRequest` hook scope (`/v1/*`) need modification? [Assumption, plan.md §server.ts]
- [ ] CHK044 - Is the CDN availability assumption for auth0-spa-js and Chart.js addressed — are fallback or self-hosted options specified for air-gapped enterprise deployments? [Assumption, research.md §1/§2]

## Notes

- This is a pre-implementation reviewer gate covering security, API, UX, and data cross-cutting concerns.
- Items reference spec sections (FR-xxx, SC-xxx), clarification session decisions, API contracts, and research decisions.
- Focus areas: PKCE auth surface (new), responsive mobile override (changed), admin access boundaries, API contract precision.
- 44 items total across 8 quality dimensions.
