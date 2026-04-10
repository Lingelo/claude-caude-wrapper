<!--
Sync Impact Report
==================
Version change: 1.1.1 → 1.2.0
Bump rationale: MINOR — added Data Retention & Log Rotation policy
  to Security & Reliability Standards (legal compliance requirement)
Modified principles: None
Modified sections:
  - Security & Reliability Standards — added Data Retention & Log
    Rotation subsection (3-month retention, legal compliance)
Added sections: None (content added within existing section)
Removed sections: None
Templates requiring updates:
  - .specify/templates/plan-template.md — ✅ compatible
  - .specify/templates/spec-template.md — ✅ compatible
  - .specify/templates/tasks-template.md — ✅ compatible
Follow-up TODOs: None
-->

# Claude Enterprise Proxy Constitution

## Project Purpose

**What**: An enterprise proxy + CLI wrapper for Claude Code that
replaces individual Anthropic API keys with centralized Auth0/Okta
JWT authentication.

**Why**: Enable teams to use Claude Code in enterprise environments
without distributing individual API keys, by providing:
- **Access control** — Authentication via Auth0/Okta SSO, each user
  authenticates with their corporate credentials
- **Role-based segregation** — Anthropic API keys are routed by role
  (developer, tech-lead, po), each role having its own quotas
  configured in the Anthropic Console
- **Auditability** — Every request is logged in SQLite with user
  identity, model used, and tokens consumed
- **Transparency** — The proxy is invisible to Claude Code thanks to
  native support for `ANTHROPIC_BASE_URL` and `ANTHROPIC_AUTH_TOKEN`

**Architecture**:
- `packages/proxy` — Fastify server: JWT validation → role-based key
  routing → raw forwarding to `api.anthropic.com` → usage tracking
- `packages/cli` — Commander CLI (`claude-enterprise`): Auth0 device
  flow login → token cache → spawn `claude` with proxy env vars

**Stack**: TypeScript ESM, Node.js 22+, Fastify, jose (JWKS),
better-sqlite3, Vitest, npm workspaces (monorepo)

## Core Principles

### I. Code Quality (NON-NEGOTIABLE)

All code in this repository MUST meet the following standards:

- **Type safety**: Strict TypeScript (`strict: true`) with no `any`
  escape hatches unless justified in a code review comment. Zod
  validation at every system boundary (env vars via `config.ts`,
  HTTP input, external API responses).
- **ESM discipline**: All imports MUST use `.js` extensions. No
  CommonJS fallbacks. `"type": "module"` enforced at workspace root.
- **Single responsibility**: Each module owns one concern. Proxy
  request flow: `auth.ts` → `rate-limit.ts` → `anthropic-forwarder.ts`
  → `usage-tracker.ts`. No module may skip or merge stages.
- **No dead code**: Unused exports, commented-out blocks, and
  TODO-without-ticket code MUST be removed before merge.
- **Error handling at boundaries only**: Internal functions trust
  their callers. Validation occurs at system boundaries (Fastify
  hooks, CLI argument parsing, `config.ts` env loading). No
  redundant try/catch inside service layers.

**Rationale**: This proxy handles authentication tokens and Anthropic
API keys. Sloppy types or unvalidated inputs directly translate to
security and reliability risks.

### II. Testing Standards

All changes MUST be covered by tests proportional to their risk:

- **Framework**: Vitest exclusively. No mixing test runners.
- **Unit tests**: Required for all pure logic — `key-router.ts`
  (role → key mapping), `stream-handler.ts` (SSE token extraction),
  `token-store.ts` (cache read/write), `token-refresh.ts` (refresh
  logic). MUST run without network, database, or filesystem.
- **Integration tests**: Required for the full proxy request flow
  (auth → forward → usage tracking) and CLI auth orchestration
  (cached → refresh → device flow). MAY use in-memory SQLite and
  HTTP mocks for Auth0/Anthropic upstream.
- **No mocks for what you own**: Do not mock internal modules. Mock
  only external boundaries (Auth0 JWKS endpoint, Anthropic upstream
  API, filesystem for token store).
- **Test naming**: `describe("<module>")` → `it("<behavior in plain
  English>")`. Test files colocate with source or live under
  `__tests__/`.
- **CI gate**: All tests MUST pass before merge. No `skip` or `only`
  committed to the default branch.

**Rationale**: The proxy is a security-critical intermediary. Untested
auth logic or a buggy stream handler can silently leak tokens or
corrupt data.

### III. User Experience Consistency

The CLI and proxy MUST deliver a predictable, transparent experience:

- **Silent success, loud failure**: Successful operations produce
  minimal output. Errors MUST include the failing operation, the root
  cause, and a suggested remediation action.
- **Auth flow transparency**: Every authentication step (cached token
  reuse, refresh attempt, device flow redirect with browser open)
  MUST log a single-line status so the user understands what happens.
- **Claude Code compatibility**: The proxy MUST behave as a drop-in
  replacement for `api.anthropic.com`. Any response format divergence
  (status codes, headers, SSE event structure) is a P0 bug. The
  `apiKeyHelper` re-auth mechanism MUST work when JWT expires (401).
- **Graceful degradation**: If the proxy is unreachable, the CLI MUST
  surface a clear error with the proxy URL and suggest checking
  connectivity — never silently fall back to direct API access.
- **Configuration validation**: All config errors (missing env vars,
  malformed `ROLE_KEYS_CONFIG`, invalid Auth0 domain) MUST be caught
  at startup with a human-readable message, not at first request time.

**Rationale**: Enterprise users authenticate through an unfamiliar
proxy layer. Any confusion during auth or opaque proxy errors erodes
trust and generates support tickets.

### IV. Performance Requirements

The proxy MUST NOT degrade the Claude Code experience:

- **Latency overhead**: The proxy MUST add less than 50ms p99 to any
  request (JWT validation + key routing + header rewrite). Streaming
  responses MUST begin forwarding the first SSE chunk within 100ms
  of receiving it from upstream.
- **Stream integrity**: The proxy MUST forward SSE bytes verbatim.
  Usage extraction (`input_tokens` from `message_start`,
  `output_tokens` from `message_delta`) MUST be read-only observation,
  never mutation. A parsing failure in `stream-handler.ts` MUST NOT
  interrupt or delay the stream.
- **Connection handling**: The proxy MUST support concurrent streaming
  connections. No request queuing or serialization.
- **Resource efficiency**: SQLite writes (usage tracking) MUST be
  non-blocking relative to the response. WAL mode is mandatory.
  Token cache reads in the CLI MUST complete in under 5ms.
- **Startup time**: The proxy MUST be ready to accept requests within
  2 seconds of process start (JWKS prefetch MAY be lazy).

**Rationale**: Users interact with Claude Code in real-time. Any
perceptible delay introduced by the proxy undermines the value
proposition of enterprise authentication.

### V. Transparent Proxy Principle (NON-NEGOTIABLE)

The proxy is a pass-through, not a middleware:

- **No body parsing**: The proxy MUST NOT parse or modify request/
  response message bodies. It forwards raw bytes. Only `model` and
  `stream` fields are read from the request (for routing/logging),
  and `usage` from the response (for tracking).
- **Header surgery only**: The proxy performs exactly one mutation:
  strip the client `Authorization: Bearer <JWT>` header and inject
  `x-api-key: <role-key>`. Passthrough headers (`anthropic-beta`,
  `anthropic-version`, `X-Claude-Code-Session-Id`) MUST be forwarded
  verbatim.
- **No feature gating**: The proxy MUST NOT filter, limit, or
  modify Claude Code features (tools, streaming, extended thinking).
  If Anthropic adds a new API capability, it MUST work through the
  proxy without proxy-side changes.
- **Upstream fidelity**: HTTP status codes, error response bodies,
  and SSE event structure from `api.anthropic.com` MUST be forwarded
  to the client unchanged.

**Rationale**: The proxy exists for auth and tracking, not content
control. Any interference with request/response bodies creates a
behavioral delta between direct access and proxy access — which is
unacceptable.

## Security & Reliability Standards

These constraints apply across both packages:

- **Secrets isolation**: API keys MUST never appear in logs, error
  messages, HTTP responses, or client-facing headers. The proxy
  strips the client JWT and injects the role key in a single
  operation — no intermediate state where both are present.
- **Token storage**: CLI tokens MUST be stored with `0600` permissions
  in `~/.claude-enterprise/token.json`. Tokens are considered expired
  5 minutes before actual expiry to prevent edge-case auth failures.
- **Dependency minimalism**: New dependencies require justification.
  Prefer Node.js built-ins and existing dependencies (`jose`,
  `better-sqlite3`, `fastify`) over adding new packages.
- **Graceful shutdown**: The proxy MUST drain in-flight requests on
  SIGTERM before exiting. Active SSE streams MUST complete or
  timeout, not be killed mid-response.
- **Auth0 trust boundary**: The proxy trusts Auth0 JWKS as the sole
  source of JWT verification. Role claims are extracted from the
  validated token — never from client-supplied headers or query
  parameters.
- **Data retention & log rotation**: Usage records in SQLite MUST be
  retained for exactly 3 months (90 days) from creation date, then
  permanently deleted. This is a legal compliance requirement — no
  user-identifiable data (email, sub, request logs) may persist
  beyond the 90-day window. The proxy MUST implement automated
  purging (scheduled job or on-write cleanup) to enforce this limit.
  Backups containing usage data MUST follow the same retention
  policy. The retention period MUST NOT be extended without legal
  review and a constitution amendment.

## Development Workflow & Quality Gates

All contributions MUST follow this workflow:

- **Pre-commit**: Lint (`npm run lint`) and type-check (`npm run
  build`) MUST pass. No `// @ts-ignore` or `eslint-disable` without
  a linked justification comment.
- **PR requirements**: Every PR MUST include tests for new behavior.
  PRs touching auth logic (`auth.ts`, `device-flow.ts`,
  `token-refresh.ts`) require explicit security review.
- **Workspace isolation**: Changes to `packages/proxy` MUST NOT
  require changes to `packages/cli` unless the contract between
  them changes (proxy URL format, auth header format). The two
  packages share no runtime code.
- **Commit discipline**: One logical change per commit. Conventional
  commit format (`feat:`, `fix:`, `refactor:`, `test:`, `docs:`).

## Governance

This constitution is the authoritative source of engineering standards
for the Claude Enterprise Proxy project. All code reviews, architectural
decisions, and implementation plans MUST verify compliance with these
principles.

- **Amendments**: Any change to this constitution MUST be documented
  with a version bump, rationale, and migration plan if existing code
  is affected.
- **Versioning**: Follows semantic versioning — MAJOR for principle
  removals or incompatible redefinitions, MINOR for new principles or
  material expansions, PATCH for clarifications and wording fixes.
- **Compliance review**: The Constitution Check section in implementation
  plans (`plan-template.md`) MUST validate against the current version
  of this document before work begins.
- **Exceptions**: Any deviation from these principles MUST be documented
  in the plan's Complexity Tracking table with a justification and the
  simpler alternative that was rejected.

**Version**: 1.2.0 | **Ratified**: 2026-04-10 | **Last Amended**: 2026-04-10
