CREATE TABLE IF NOT EXISTS usage_log (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp       TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    user_sub        TEXT    NOT NULL,
    user_email      TEXT    NOT NULL,
    user_role       TEXT    NOT NULL DEFAULT 'default',
    session_id      TEXT,
    endpoint        TEXT    NOT NULL,
    model           TEXT    NOT NULL,
    input_tokens    INTEGER NOT NULL DEFAULT 0,
    output_tokens   INTEGER NOT NULL DEFAULT 0,
    cache_creation_input_tokens INTEGER NOT NULL DEFAULT 0,
    cache_read_input_tokens     INTEGER NOT NULL DEFAULT 0,
    request_duration_ms         INTEGER,
    status_code     INTEGER NOT NULL DEFAULT 200,
    error_message   TEXT
);

CREATE INDEX IF NOT EXISTS idx_usage_user_sub  ON usage_log (user_sub);
CREATE INDEX IF NOT EXISTS idx_usage_timestamp ON usage_log (timestamp);
CREATE INDEX IF NOT EXISTS idx_usage_session   ON usage_log (session_id);
CREATE INDEX IF NOT EXISTS idx_usage_user_time ON usage_log (user_sub, timestamp);
CREATE INDEX IF NOT EXISTS idx_usage_role      ON usage_log (user_role);
