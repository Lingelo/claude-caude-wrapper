# Dashboard API Contracts

**Base path**: `/api/dashboard`
**Auth**: All endpoints require a valid Auth0 JWT (same validation as `/v1/*` proxy routes).
**Content-Type**: `application/json` (responses)

## Common Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `from` | string (ISO date) | First day of current month | Start of date range (inclusive) |
| `to` | string (ISO date) | Today | End of date range (exclusive) |

Date range is clamped to 90 days maximum. Requests exceeding 90 days receive a `400` error.

---

## GET /api/dashboard/me/summary

Personal usage summary for the authenticated user.

**Auth**: Any authenticated user.

**Response 200**:
```json
{
  "user_sub": "auth0|abc123",
  "user_email": "dev@company.com",
  "user_role": "developer",
  "period": { "from": "2026-03-01", "to": "2026-04-01" },
  "summary": {
    "request_count": 342,
    "input_tokens": 1250000,
    "output_tokens": 890000,
    "cache_creation_input_tokens": 45000,
    "cache_read_input_tokens": 120000
  }
}
```

---

## GET /api/dashboard/me/daily

Daily token breakdown for the authenticated user.

**Auth**: Any authenticated user.

**Response 200**:
```json
{
  "period": { "from": "2026-03-01", "to": "2026-04-01" },
  "days": [
    {
      "date": "2026-03-01",
      "input_tokens": 45000,
      "output_tokens": 32000,
      "cache_creation_input_tokens": 2000,
      "cache_read_input_tokens": 8000,
      "request_count": 12
    }
  ]
}
```

Empty array when no data: `{ "days": [] }`.

---

## GET /api/dashboard/me/models

Per-model token breakdown for the authenticated user.

**Auth**: Any authenticated user.

**Response 200**:
```json
{
  "period": { "from": "2026-03-01", "to": "2026-04-01" },
  "models": [
    {
      "model": "claude-sonnet-4-6",
      "input_tokens": 800000,
      "output_tokens": 600000,
      "cache_creation_input_tokens": 15000,
      "cache_read_input_tokens": 50000,
      "request_count": 210
    }
  ]
}
```

---

## GET /api/dashboard/admin/summary

Aggregated usage across all users, grouped by role.

**Auth**: Admin only (role = `tech-lead`). Returns `403` for non-admin users.

**Response 200**:
```json
{
  "period": { "from": "2026-03-01", "to": "2026-04-01" },
  "total": {
    "request_count": 5420,
    "input_tokens": 18500000,
    "output_tokens": 12300000,
    "cache_creation_input_tokens": 350000,
    "cache_read_input_tokens": 1200000,
    "active_users": 23
  },
  "by_role": [
    {
      "role": "developer",
      "user_count": 18,
      "request_count": 4100,
      "input_tokens": 14000000,
      "output_tokens": 9500000,
      "cache_creation_input_tokens": 280000,
      "cache_read_input_tokens": 950000
    }
  ]
}
```

---

## GET /api/dashboard/admin/users

User ranking by total token consumption.

**Auth**: Admin only. Returns `403` for non-admin users.

**Query params**: `limit` (integer, default 50, max 100)

**Response 200**:
```json
{
  "period": { "from": "2026-03-01", "to": "2026-04-01" },
  "users": [
    {
      "user_sub": "auth0|abc123",
      "user_email": "dev@company.com",
      "user_role": "developer",
      "total_tokens": 2140000,
      "input_tokens": 1250000,
      "output_tokens": 890000,
      "cache_creation_input_tokens": 45000,
      "cache_read_input_tokens": 120000,
      "request_count": 342
    }
  ]
}
```

---

## GET /api/dashboard/admin/trend

Daily trend across all users.

**Auth**: Admin only. Returns `403` for non-admin users.

**Response 200**:
```json
{
  "period": { "from": "2026-03-01", "to": "2026-04-01" },
  "days": [
    {
      "date": "2026-03-01",
      "input_tokens": 620000,
      "output_tokens": 410000,
      "cache_creation_input_tokens": 12000,
      "cache_read_input_tokens": 45000,
      "request_count": 186,
      "active_users": 15
    }
  ]
}
```

---

## GET /api/dashboard/admin/export

CSV export of usage data.

**Auth**: Admin only. Returns `403` for non-admin users.

**Response 200** (`Content-Type: text/csv`, `Content-Disposition: attachment`):
```csv
date,user_email,user_role,model,input_tokens,output_tokens,cache_creation_input_tokens,cache_read_input_tokens,request_count
2026-03-01,dev@company.com,developer,claude-sonnet-4-6,45000,32000,2000,8000,12
```

Rows are aggregated by (date, user, role, model) — not raw request rows.

---

## Error Responses

| Status | Body | When |
|--------|------|------|
| 401 | `{ "error": "unauthorized", "message": "..." }` | Missing or invalid JWT |
| 403 | `{ "error": "forbidden", "message": "Admin access required" }` | Non-admin hits `/admin/*` |
| 400 | `{ "error": "bad_request", "message": "Date range exceeds 90 days" }` | Invalid query params |

---

## Static Files

| Path | Serves |
|------|--------|
| `GET /dashboard` | `index.html` (SPA entry point) |
| `GET /dashboard/*` | Static assets (JS, CSS, images) |
| `GET /dashboard/callback` | Auth0 PKCE callback (handled client-side) |
