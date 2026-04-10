# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Project Is

An enterprise proxy + CLI wrapper for Claude Code that replaces direct Anthropic API keys with Auth0/Okta JWT authentication. The proxy holds the real API keys server-side, validates JWT tokens, routes requests to role-based API keys (developer/tech-lead/po), forwards to `api.anthropic.com`, and tracks per-user usage in SQLite.

Claude Code natively supports this via `ANTHROPIC_BASE_URL` (redirect API calls) and `ANTHROPIC_AUTH_TOKEN` (Bearer JWT on every request).

## Commands

```bash
npm run build              # Build all workspaces
npm run dev:proxy          # Dev proxy with hot reload (tsx watch)
npm run dev:cli            # Dev CLI
npm test                   # Run tests in all workspaces
npm run lint               # ESLint across all packages

# Single workspace
npm run test -w packages/proxy     # Proxy tests only
npm run build -w packages/cli      # Build CLI only

# Run proxy
npm start -w packages/proxy

# Run CLI in dev
npx tsx packages/cli/bin/claude-enterprise.ts
```

Tests use **vitest**. Run a single test file: `npx vitest run path/to/test.ts -w packages/proxy`

## Architecture

**Monorepo** with npm workspaces, two packages, all TypeScript ESM (`"type": "module"`).

### `packages/proxy` — Fastify server

Request flow: `Client → auth.ts (JWT validate) → rate-limit.ts → anthropic-forwarder.ts → api.anthropic.com`

- **`middleware/auth.ts`** — Validates JWT against Auth0 JWKS (`jose.createRemoteJWKSet`). Attaches `UserContext` (sub, email, role) to the request. Returns 401 on failure, which triggers Claude Code's `apiKeyHelper` re-auth.
- **`services/key-router.ts`** — Maps Auth0 role claim to an Anthropic API key via `ROLE_KEYS_CONFIG` JSON (must include a `"default"` fallback).
- **`services/anthropic-forwarder.ts`** — Core proxy. Strips client JWT, injects the role's API key as `x-api-key`, forwards headers (`anthropic-beta`, `anthropic-version`, `X-Claude-Code-Session-Id`). Handles both non-streaming (JSON response) and streaming (SSE pipe-through).
- **`services/stream-handler.ts`** — Parses SSE events in-flight to extract `input_tokens` from `message_start` and `output_tokens` from `message_delta`, without modifying the stream bytes.
- **`services/usage-tracker.ts`** — Inserts usage records into SQLite via `better-sqlite3` prepared statement.
- **`db/sqlite.ts`** — Initializes SQLite with WAL mode. Schema lives in `db/schema.sql`.
- **`config.ts`** — Loads env vars with Zod validation. `ROLE_KEYS_CONFIG` accepts a file path or inline JSON.

Routes: `POST /v1/messages`, `POST /v1/messages/count_tokens`, `GET /health` (no auth).

### `packages/cli` — Commander CLI (`claude-enterprise`)

- **`auth/device-flow.ts`** — OAuth 2.0 Device Authorization Grant (RFC 8628) against Auth0. Opens browser, polls for token.
- **`auth/token-store.ts`** — Caches tokens in `~/.claude-enterprise/token.json` with `0600` permissions. Considers tokens expired 5 minutes early.
- **`auth/token-refresh.ts`** — Refreshes via Auth0 `grant_type=refresh_token`. Deletes cached tokens on failure to force re-auth.
- **`auth/index.ts`** — Orchestrates: cached token → refresh → device flow login.
- **`spawn.ts`** — `child_process.spawn("claude", args)` with `stdio: "inherit"` for TTY passthrough, sets `ANTHROPIC_BASE_URL` and `ANTHROPIC_AUTH_TOKEN` env vars.

CLI commands: `configure`, `login`, `logout`, `status`, `run` (default — forwards args to `claude`).

## Key Environment Variables (Proxy)

| Variable | Required | Purpose |
|---|---|---|
| `AUTH0_DOMAIN` | Yes | e.g. `tenant.auth0.com` |
| `AUTH0_AUDIENCE` | Yes | Auth0 API identifier |
| `ROLE_KEYS_CONFIG` | Yes | Path to role→API key JSON mapping (must have `"default"` key) |
| `ANTHROPIC_UPSTREAM_URL` | No | Override upstream (default: `https://api.anthropic.com`) — useful for testing with a mock |

## Conventions

- All imports use `.js` extensions (ESM requirement for Node16 module resolution)
- User identity flows as `UserContext` type (sub/email/role) attached to Fastify request after auth
- The proxy never parses or modifies the message body — it forwards raw bytes and only extracts `model`/`stream` from request and `usage` from response

## Active Technologies
- TypeScript 5.7 (API routes), vanilla JS ES2022 (frontend — no build step) + Fastify 5.2, `@fastify/static` (new), `@auth0/auth0-spa-js` (CDN), Chart.js 4.x (CDN), better-sqlite3 11.7 (existing) (001-usage-dashboard)
- Existing SQLite `usage_log` table (read-only access, no schema changes) (001-usage-dashboard)

## Recent Changes
- 001-usage-dashboard: Added TypeScript 5.7 (API routes), vanilla JS ES2022 (frontend — no build step) + Fastify 5.2, `@fastify/static` (new), `@auth0/auth0-spa-js` (CDN), Chart.js 4.x (CDN), better-sqlite3 11.7 (existing)
