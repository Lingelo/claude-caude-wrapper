# Quickstart: Usage Dashboard

## Prerequisites

- Node.js 22+
- Auth0 tenant with an SPA application configured (for dashboard PKCE flow)
- Running proxy with usage data in SQLite

## New Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `AUTH0_DASHBOARD_CLIENT_ID` | Yes | Auth0 SPA application client ID for the dashboard |
| `AUTH0_DASHBOARD_CALLBACK_URL` | No | Override callback URL (default: `{origin}/dashboard/callback`) |

Existing proxy env vars (`AUTH0_DOMAIN`, `AUTH0_AUDIENCE`, `DATABASE_PATH`) are reused.

## Auth0 Setup

1. Create a new **Single Page Application** in your Auth0 dashboard
2. Set **Allowed Callback URLs**: `http://localhost:8080/dashboard/callback`
3. Set **Allowed Logout URLs**: `http://localhost:8080/dashboard`
4. Set **Allowed Web Origins**: `http://localhost:8080`
5. Note the **Client ID** — set it as `AUTH0_DASHBOARD_CLIENT_ID`

## Run

```bash
# Start proxy (dashboard is served automatically)
AUTH0_DASHBOARD_CLIENT_ID=your_client_id npm start -w packages/proxy

# Open dashboard
open http://localhost:8080/dashboard
```

## Development

```bash
# Dev mode with hot reload (proxy + API routes)
npm run dev:proxy

# Dashboard static files are in packages/proxy/public/dashboard/
# Edit HTML/CSS/JS directly — refresh browser to see changes
```

## Test Dashboard API

```bash
# Get a JWT token first (via CLI login)
TOKEN=$(cat ~/.claude-enterprise/token.json | jq -r .access_token)

# Personal summary
curl -H "Authorization: Bearer $TOKEN" http://localhost:8080/api/dashboard/me/summary

# Admin view (requires tech-lead role)
curl -H "Authorization: Bearer $TOKEN" http://localhost:8080/api/dashboard/admin/summary
```
