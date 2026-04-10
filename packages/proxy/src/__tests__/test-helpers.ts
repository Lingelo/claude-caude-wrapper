import Database from "better-sqlite3";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

export function createTestDb(): Database.Database {
  const db = new Database(":memory:");
  const schema = readFileSync(
    resolve(__dirname, "../db/schema.sql"),
    "utf-8"
  );
  db.exec(schema);
  return db;
}

export function seedUsageData(
  db: Database.Database,
  records: Array<{
    user_sub: string;
    user_email: string;
    user_role: string;
    model: string;
    input_tokens: number;
    output_tokens: number;
    cache_creation_input_tokens?: number;
    cache_read_input_tokens?: number;
    timestamp?: string;
  }>
) {
  const stmt = db.prepare(`
    INSERT INTO usage_log (user_sub, user_email, user_role, endpoint, model,
      input_tokens, output_tokens, cache_creation_input_tokens,
      cache_read_input_tokens, timestamp)
    VALUES (?, ?, ?, '/v1/messages', ?, ?, ?, ?, ?, ?)
  `);

  for (const r of records) {
    stmt.run(
      r.user_sub,
      r.user_email,
      r.user_role,
      r.model,
      r.input_tokens,
      r.output_tokens,
      r.cache_creation_input_tokens ?? 0,
      r.cache_read_input_tokens ?? 0,
      r.timestamp ?? new Date().toISOString()
    );
  }
}
