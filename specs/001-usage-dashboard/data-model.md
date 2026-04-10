# Data Model: Usage Dashboard

**Source**: Existing `usage_log` table in proxy SQLite database (read-only access).

## Existing Entity: usage_log (no changes)

The dashboard reads from the existing table. No schema modifications needed.

| Field | Type | Description |
|-------|------|-------------|
| id | INTEGER PK | Auto-increment |
| timestamp | TEXT | ISO 8601 UTC (`strftime('%Y-%m-%dT%H:%M:%fZ')`) |
| user_sub | TEXT NOT NULL | Auth0 subject identifier |
| user_email | TEXT NOT NULL | User email from JWT |
| user_role | TEXT NOT NULL | Role claim: `developer`, `tech-lead`, `po` (default: `default`) |
| session_id | TEXT | Claude Code session ID (nullable) |
| endpoint | TEXT NOT NULL | API endpoint called |
| model | TEXT NOT NULL | Anthropic model used |
| input_tokens | INTEGER | Tokens sent to model |
| output_tokens | INTEGER | Tokens received from model |
| cache_creation_input_tokens | INTEGER | Prompt cache creation tokens |
| cache_read_input_tokens | INTEGER | Prompt cache read tokens |
| request_duration_ms | INTEGER | Request latency (nullable) |
| status_code | INTEGER | HTTP status (default: 200) |
| error_message | TEXT | Error details (nullable) |

### Existing Indices

- `idx_usage_user_sub` — user_sub
- `idx_usage_timestamp` — timestamp
- `idx_usage_session` — session_id
- `idx_usage_user_time` — (user_sub, timestamp) composite
- `idx_usage_role` — user_role

### Query Patterns (Dashboard API)

All queries use aggregation — no raw row fetches.

#### Personal Summary (user view)

```sql
SELECT
  COUNT(*) as request_count,
  SUM(input_tokens) as total_input,
  SUM(output_tokens) as total_output,
  SUM(cache_creation_input_tokens) as total_cache_creation,
  SUM(cache_read_input_tokens) as total_cache_read
FROM usage_log
WHERE user_sub = ? AND timestamp >= ? AND timestamp < ?
```

Uses index: `idx_usage_user_time`

#### Daily Breakdown (user view)

```sql
SELECT
  DATE(timestamp) as day,
  SUM(input_tokens) as input,
  SUM(output_tokens) as output,
  SUM(cache_creation_input_tokens) as cache_creation,
  SUM(cache_read_input_tokens) as cache_read,
  COUNT(*) as requests
FROM usage_log
WHERE user_sub = ? AND timestamp >= ? AND timestamp < ?
GROUP BY DATE(timestamp)
ORDER BY day
```

Uses index: `idx_usage_user_time`

#### Per-Model Breakdown (user view)

```sql
SELECT
  model,
  SUM(input_tokens) as input,
  SUM(output_tokens) as output,
  SUM(cache_creation_input_tokens) as cache_creation,
  SUM(cache_read_input_tokens) as cache_read,
  COUNT(*) as requests
FROM usage_log
WHERE user_sub = ? AND timestamp >= ? AND timestamp < ?
GROUP BY model
ORDER BY (input + output) DESC
```

Uses index: `idx_usage_user_time`

#### Admin: Aggregated by Role

```sql
SELECT
  user_role,
  COUNT(DISTINCT user_sub) as user_count,
  SUM(input_tokens) as total_input,
  SUM(output_tokens) as total_output,
  SUM(cache_creation_input_tokens) as total_cache_creation,
  SUM(cache_read_input_tokens) as total_cache_read,
  COUNT(*) as request_count
FROM usage_log
WHERE timestamp >= ? AND timestamp < ?
GROUP BY user_role
```

Uses index: `idx_usage_role` (partial), `idx_usage_timestamp`

#### Admin: User Ranking

```sql
SELECT
  user_sub,
  user_email,
  user_role,
  SUM(input_tokens + output_tokens) as total_tokens,
  SUM(input_tokens) as total_input,
  SUM(output_tokens) as total_output,
  SUM(cache_creation_input_tokens) as total_cache_creation,
  SUM(cache_read_input_tokens) as total_cache_read,
  COUNT(*) as request_count
FROM usage_log
WHERE timestamp >= ? AND timestamp < ?
GROUP BY user_sub
ORDER BY total_tokens DESC
LIMIT 50
```

#### Admin: Daily Trend (all users)

```sql
SELECT
  DATE(timestamp) as day,
  SUM(input_tokens) as input,
  SUM(output_tokens) as output,
  SUM(cache_creation_input_tokens) as cache_creation,
  SUM(cache_read_input_tokens) as cache_read,
  COUNT(*) as requests,
  COUNT(DISTINCT user_sub) as active_users
FROM usage_log
WHERE timestamp >= ? AND timestamp < ?
GROUP BY DATE(timestamp)
ORDER BY day
```

Uses index: `idx_usage_timestamp`

## New Index Consideration

For admin queries aggregating by role + timestamp range, consider adding:

```sql
CREATE INDEX IF NOT EXISTS idx_usage_role_time ON usage_log (user_role, timestamp);
```

Decision deferred to implementation — test with realistic data first. Current indices may suffice for <100 users.

## Retention Boundary

All queries MUST enforce `timestamp >= date('now', '-90 days')` to respect the 90-day retention policy. This is enforced at the API layer, not the query layer, to keep SQL reusable.

## Derived Concepts (not stored)

- **Total Tokens**: `input_tokens + output_tokens` (computed in queries)
- **Active User**: Any `user_sub` with at least one record in the selected period
- **Admin User**: User whose JWT role claim is `tech-lead` (checked at API layer)
