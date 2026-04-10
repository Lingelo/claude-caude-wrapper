# Feature Specification: Usage Dashboard

**Feature Branch**: `001-usage-dashboard`
**Created**: 2026-04-10
**Status**: Draft
**Input**: User description: "Add a web application with a dashboard to monitor token consumption per user. Tokens sent, received, etc. to monitor usage by role and by user. Sleek look."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - View Personal Token Consumption (Priority: P1)

As an authenticated user (developer, tech-lead, or po), I want to see
my own token consumption on a dashboard so I can understand my usage
patterns and stay within my quota.

I open the dashboard in my browser. I see a summary of my total tokens
consumed (input and output) for the current period, a breakdown by day,
and my most-used models. The interface loads fast and feels modern.

**Why this priority**: Every user needs visibility into their own
consumption first. This is the minimum viable product — a single-user
view that delivers immediate value without requiring admin privileges.

**Independent Test**: Can be fully tested by logging in as any user and
verifying the dashboard displays usage data matching the SQLite records
for that user.

**Acceptance Scenarios**:

1. **Given** I am logged in, **When** I open the dashboard, **Then** I see
   my total input tokens, output tokens, and request count for the
   current month
2. **Given** I have usage data spanning multiple days, **When** I view the
   dashboard, **Then** I see a daily breakdown chart of my consumption
3. **Given** I have used multiple models, **When** I view the dashboard,
   **Then** I see a breakdown of tokens consumed per model
4. **Given** I have no usage data yet, **When** I open the dashboard,
   **Then** I see an empty state with a clear message ("No usage recorded
   yet")

---

### User Story 2 - Admin Overview by Role and User (Priority: P2)

As an admin (tech-lead or designated admin role), I want to see
aggregated token consumption across all users and roles so I can
monitor team usage, identify heavy consumers, and make informed
decisions about quota allocation.

I open the admin view. I see a top-level summary (total tokens across
all users), a breakdown by role (developer vs tech-lead vs po), and a
ranked list of users by consumption. I can filter by date range.

**Why this priority**: Without an admin view, the dashboard only serves
individual users. The admin perspective is the key driver for enterprise
adoption — managers need visibility to justify costs and manage quotas.

**Independent Test**: Can be fully tested by logging in as an admin,
verifying aggregated data matches the sum of individual user records in
SQLite, and confirming role-level grouping is accurate.

**Acceptance Scenarios**:

1. **Given** I am logged in as an admin, **When** I open the admin view,
   **Then** I see total input tokens, output tokens, and request count
   across all users for the selected period
2. **Given** multiple users with different roles have usage data, **When**
   I view the role breakdown, **Then** I see aggregated consumption
   grouped by role (developer, tech-lead, po)
3. **Given** I am on the admin view, **When** I select a specific date
   range, **Then** all metrics and charts update to reflect only that
   period
4. **Given** I am on the admin view, **When** I view the user ranking,
   **Then** I see users sorted by total token consumption (descending)
   with their role displayed

---

### User Story 3 - Trend Analysis and Export (Priority: P3)

As an admin, I want to see usage trends over time and export data so I
can produce reports for management and track consumption evolution
week-over-week or month-over-month.

I select a time range and see a trend chart showing daily or weekly
aggregated consumption. I can export the underlying data for use in
external reporting tools.

**Why this priority**: Trend analysis and export are valuable but not
essential for the initial launch. The dashboard delivers core value
without them. This is an enhancement layer for mature usage.

**Independent Test**: Can be fully tested by generating usage data over
multiple weeks, verifying the trend chart renders correctly, and
downloading an export file whose content matches the displayed data.

**Acceptance Scenarios**:

1. **Given** I am an admin viewing the dashboard, **When** I select a
   multi-week date range, **Then** I see a trend line chart showing
   daily token consumption over that period
2. **Given** I am viewing trend data, **When** I click export, **Then** I
   receive a CSV file containing the displayed data (date, user, role,
   input tokens, output tokens, model, request count)
3. **Given** I export data, **When** I open the CSV, **Then** all rows
   match the data visible in the dashboard for the selected period

---

### Edge Cases

- What happens when the SQLite database is empty (first deployment)?
  The dashboard MUST display a meaningful empty state, not an error.
- What happens when a user has been deleted from Auth0 but still has
  historical usage records? The dashboard MUST display the records with
  the original email/sub, not fail.
- What happens when the date range filter produces no results? The
  dashboard MUST show "No data for selected period", not an empty chart.
- What happens when the usage database grows large? With under 100
  users and 90-day retention, row counts stay manageable. The dashboard
  MUST use aggregation queries (not raw row fetches) and respect
  SC-001/SC-003 latency targets.
- What happens when the dashboard is accessed without authentication?
  The user MUST be redirected to the Auth0 Authorization Code + PKCE
  login flow, then returned to `/dashboard` after successful login.
- What happens when the 90-day data retention policy has purged old
  records? The dashboard MUST only show available data and not offer
  date ranges beyond retention limits.

## Clarifications

### Session 2026-04-10

- Q: Where should the dashboard be hosted relative to the proxy? → A: Same Fastify server — dashboard served as static files under `/dashboard` with API routes added to the proxy
- Q: Which frontend technology for the dashboard UI? → A: Vanilla HTML/CSS/JS with a charting library (Chart.js or ECharts) — no framework, no build step
- Q: How should the dashboard authenticate users? → A: Browser-based Auth0 login (Authorization Code + PKCE) — standard SPA auth flow with redirect
- Q: Expected maximum number of active users? → A: Under 100 users — enterprise team scale, SQLite handles this without caching or materialized views

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST authenticate dashboard users via Auth0
  Authorization Code + PKCE flow (browser-based SPA login) using the
  same Auth0 tenant and audience as the proxy. Requires a dedicated
  Auth0 SPA application (client ID, callback URL for `/dashboard`)
- **FR-002**: System MUST display per-user token consumption: input
  tokens sent, output tokens received, cache creation tokens, cache
  read tokens, and total request count — across all views (summary,
  daily breakdown, per-model breakdown)
- **FR-003**: System MUST display a daily breakdown chart of token
  consumption for the authenticated user
- **FR-004**: System MUST display a per-model breakdown of token
  consumption
- **FR-005**: System MUST provide an admin view showing aggregated
  consumption across all users, grouped by role
- **FR-006**: System MUST provide a user ranking (sorted by total
  tokens consumed) in the admin view
- **FR-007**: System MUST support date range filtering on all views
  (default: current month, maximum: 90 days per retention policy)
- **FR-008**: System MUST display a trend chart showing daily
  consumption over a selected period (admin view)
- **FR-009**: System MUST allow admins to export usage data as CSV
- **FR-010**: System MUST restrict admin views to users with the
  `tech-lead` role exclusively (no configurable admin list)
- **FR-011**: System MUST read usage data from the existing SQLite
  database used by the proxy (no data duplication)
- **FR-012**: System MUST respect the 90-day data retention policy —
  no data older than 90 days may be displayed or exported
- **FR-013**: System MUST present a sleek, modern visual design with
  clean typography, generous whitespace, and a dark/light mode toggle
- **FR-014**: Dashboard frontend MUST be implemented as vanilla
  HTML/CSS/JS with a charting library (Chart.js or ECharts) — no
  framework or build step required

### Key Entities

- **Usage Record**: A single proxy request log — user identity (sub,
  email), role, model used, input tokens, output tokens, timestamp.
  Already exists in the proxy SQLite database.
- **User**: Identified by Auth0 sub and email. Has a role (developer,
  tech-lead, po). Derived from usage records, not stored separately.
- **Role**: One of developer, tech-lead, po. Used for grouping and
  access control (admin vs regular user).
- **Period**: A date range used for filtering and aggregation. Bounded
  by the 90-day retention policy.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can view their personal token consumption summary
  within 3 seconds of opening the dashboard
- **SC-002**: Admin users can identify the top 10 token consumers
  across the organization within 5 seconds
- **SC-003**: Date range filtering updates all charts and metrics
  within 2 seconds
- **SC-004**: 90% of users can locate their daily consumption
  breakdown on first visit without guidance
- **SC-005**: CSV export completes within 10 seconds for a full
  90-day dataset
- **SC-006**: The dashboard is responsive and usable across desktop
  (1280px+), tablet (768px+), and mobile (375px+) viewports with a
  polished, professional appearance
- **SC-007**: No user-identifiable data is displayed to non-admin
  users — each user sees only their own data

## Assumptions

- The existing SQLite database schema (usage records with sub, email,
  role, model, input_tokens, output_tokens, timestamp) provides all
  data needed — no schema changes required for read access
- The dashboard is served as static files by the existing Fastify
  proxy under `/dashboard`, with API routes added to the same server
  (single process, no CORS, shared auth middleware)
- Authentication reuses the same Auth0 tenant and audience as the
  proxy — no separate identity provider setup needed
- The dashboard MUST be responsive and mobile-ready from v1
  (mobile-first CSS, flexbox/grid layout adapting to all viewports)
- The admin role is exclusively `tech-lead` (determined by Auth0
  role claim); no configurable admin list or separate admin
  configuration is needed
- The dashboard is read-only — it does not modify usage records or
  proxy configuration
- Expected scale is under 100 active users — enterprise team context.
  SQLite with simple aggregation queries is sufficient without caching
  layers or materialized views
- Real-time streaming updates are out of scope for v1; the dashboard
  shows data as of page load or manual refresh
