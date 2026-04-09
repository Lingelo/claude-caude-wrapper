import type Database from "better-sqlite3";
import type { UsageRecord } from "../types.js";

export class UsageTracker {
  private insertStmt: Database.Statement;

  constructor(db: Database.Database) {
    this.insertStmt = db.prepare(`
      INSERT INTO usage_log (
        user_sub, user_email, user_role, session_id, endpoint, model,
        input_tokens, output_tokens, cache_creation_input_tokens,
        cache_read_input_tokens, request_duration_ms, status_code, error_message
      ) VALUES (
        @user_sub, @user_email, @user_role, @session_id, @endpoint, @model,
        @input_tokens, @output_tokens, @cache_creation_input_tokens,
        @cache_read_input_tokens, @request_duration_ms, @status_code, @error_message
      )
    `);
  }

  record(usage: UsageRecord): void {
    this.insertStmt.run(usage);
  }
}
