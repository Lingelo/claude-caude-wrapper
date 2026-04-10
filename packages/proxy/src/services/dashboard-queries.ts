import type Database from "better-sqlite3";
import { z } from "zod";

const personalSummarySchema = z.object({
  request_count: z.number(),
  total_input: z.number(),
  total_output: z.number(),
  total_cache_creation: z.number(),
  total_cache_read: z.number(),
});

const dailyRowSchema = z.object({
  day: z.string(),
  input: z.number(),
  output: z.number(),
  cache_creation: z.number(),
  cache_read: z.number(),
  requests: z.number(),
});

const modelRowSchema = z.object({
  model: z.string(),
  input: z.number(),
  output: z.number(),
  cache_creation: z.number(),
  cache_read: z.number(),
  requests: z.number(),
});

const adminRoleRowSchema = z.object({
  user_role: z.string(),
  user_count: z.number(),
  total_input: z.number(),
  total_output: z.number(),
  total_cache_creation: z.number(),
  total_cache_read: z.number(),
  request_count: z.number(),
});

const adminUserRowSchema = z.object({
  user_sub: z.string(),
  user_email: z.string(),
  user_role: z.string(),
  total_tokens: z.number(),
  total_input: z.number(),
  total_output: z.number(),
  total_cache_creation: z.number(),
  total_cache_read: z.number(),
  request_count: z.number(),
});

const trendRowSchema = z.object({
  day: z.string(),
  input: z.number(),
  output: z.number(),
  cache_creation: z.number(),
  cache_read: z.number(),
  requests: z.number(),
  active_users: z.number(),
});

const exportRowSchema = z.object({
  day: z.string(),
  user_email: z.string(),
  user_role: z.string(),
  model: z.string(),
  input_tokens: z.number(),
  output_tokens: z.number(),
  cache_creation_input_tokens: z.number(),
  cache_read_input_tokens: z.number(),
  request_count: z.number(),
});

export type PersonalSummary = z.infer<typeof personalSummarySchema>;
export type DailyRow = z.infer<typeof dailyRowSchema>;
export type ModelRow = z.infer<typeof modelRowSchema>;
export type AdminRoleRow = z.infer<typeof adminRoleRowSchema>;
export type AdminUserRow = z.infer<typeof adminUserRowSchema>;
export type TrendRow = z.infer<typeof trendRowSchema>;
export type ExportRow = z.infer<typeof exportRowSchema>;

export class DashboardQueries {
  private stmtPersonalSummary: Database.Statement;
  private stmtPersonalDaily: Database.Statement;
  private stmtPersonalModels: Database.Statement;
  private stmtAdminSummaryByRole: Database.Statement;
  private stmtAdminUsers: Database.Statement;
  private stmtAdminTrend: Database.Statement;
  private stmtExportData: Database.Statement;

  constructor(db: Database.Database) {
    this.stmtPersonalSummary = db.prepare(`
      SELECT
        COUNT(*) as request_count,
        COALESCE(SUM(input_tokens), 0) as total_input,
        COALESCE(SUM(output_tokens), 0) as total_output,
        COALESCE(SUM(cache_creation_input_tokens), 0) as total_cache_creation,
        COALESCE(SUM(cache_read_input_tokens), 0) as total_cache_read
      FROM usage_log
      WHERE user_sub = ? AND timestamp >= ? AND timestamp < ?
    `);

    this.stmtPersonalDaily = db.prepare(`
      SELECT
        DATE(timestamp) as day,
        COALESCE(SUM(input_tokens), 0) as input,
        COALESCE(SUM(output_tokens), 0) as output,
        COALESCE(SUM(cache_creation_input_tokens), 0) as cache_creation,
        COALESCE(SUM(cache_read_input_tokens), 0) as cache_read,
        COUNT(*) as requests
      FROM usage_log
      WHERE user_sub = ? AND timestamp >= ? AND timestamp < ?
      GROUP BY DATE(timestamp)
      ORDER BY day
    `);

    this.stmtPersonalModels = db.prepare(`
      SELECT
        model,
        COALESCE(SUM(input_tokens), 0) as input,
        COALESCE(SUM(output_tokens), 0) as output,
        COALESCE(SUM(cache_creation_input_tokens), 0) as cache_creation,
        COALESCE(SUM(cache_read_input_tokens), 0) as cache_read,
        COUNT(*) as requests
      FROM usage_log
      WHERE user_sub = ? AND timestamp >= ? AND timestamp < ?
      GROUP BY model
      ORDER BY (input + output) DESC
    `);

    this.stmtAdminSummaryByRole = db.prepare(`
      SELECT
        user_role,
        COUNT(DISTINCT user_sub) as user_count,
        COALESCE(SUM(input_tokens), 0) as total_input,
        COALESCE(SUM(output_tokens), 0) as total_output,
        COALESCE(SUM(cache_creation_input_tokens), 0) as total_cache_creation,
        COALESCE(SUM(cache_read_input_tokens), 0) as total_cache_read,
        COUNT(*) as request_count
      FROM usage_log
      WHERE timestamp >= ? AND timestamp < ?
      GROUP BY user_role
    `);

    this.stmtAdminUsers = db.prepare(`
      SELECT
        user_sub,
        user_email,
        user_role,
        COALESCE(SUM(input_tokens + output_tokens), 0) as total_tokens,
        COALESCE(SUM(input_tokens), 0) as total_input,
        COALESCE(SUM(output_tokens), 0) as total_output,
        COALESCE(SUM(cache_creation_input_tokens), 0) as total_cache_creation,
        COALESCE(SUM(cache_read_input_tokens), 0) as total_cache_read,
        COUNT(*) as request_count
      FROM usage_log
      WHERE timestamp >= ? AND timestamp < ?
      GROUP BY user_sub
      ORDER BY total_tokens DESC
      LIMIT ?
    `);

    this.stmtAdminTrend = db.prepare(`
      SELECT
        DATE(timestamp) as day,
        COALESCE(SUM(input_tokens), 0) as input,
        COALESCE(SUM(output_tokens), 0) as output,
        COALESCE(SUM(cache_creation_input_tokens), 0) as cache_creation,
        COALESCE(SUM(cache_read_input_tokens), 0) as cache_read,
        COUNT(*) as requests,
        COUNT(DISTINCT user_sub) as active_users
      FROM usage_log
      WHERE timestamp >= ? AND timestamp < ?
      GROUP BY DATE(timestamp)
      ORDER BY day
    `);

    this.stmtExportData = db.prepare(`
      SELECT
        DATE(timestamp) as day,
        user_email,
        user_role,
        model,
        COALESCE(SUM(input_tokens), 0) as input_tokens,
        COALESCE(SUM(output_tokens), 0) as output_tokens,
        COALESCE(SUM(cache_creation_input_tokens), 0) as cache_creation_input_tokens,
        COALESCE(SUM(cache_read_input_tokens), 0) as cache_read_input_tokens,
        COUNT(*) as request_count
      FROM usage_log
      WHERE timestamp >= ? AND timestamp < ?
      GROUP BY DATE(timestamp), user_email, user_role, model
      ORDER BY day, user_email, model
    `);
  }

  getPersonalSummary(userSub: string, from: string, to: string): PersonalSummary {
    const row = this.stmtPersonalSummary.get(userSub, from, to) as Record<string, unknown>;
    return personalSummarySchema.parse(row);
  }

  getPersonalDaily(userSub: string, from: string, to: string): DailyRow[] {
    const rows = this.stmtPersonalDaily.all(userSub, from, to) as Record<string, unknown>[];
    return rows.map((r) => dailyRowSchema.parse(r));
  }

  getPersonalModels(userSub: string, from: string, to: string): ModelRow[] {
    const rows = this.stmtPersonalModels.all(userSub, from, to) as Record<string, unknown>[];
    return rows.map((r) => modelRowSchema.parse(r));
  }

  getAdminSummaryByRole(from: string, to: string): AdminRoleRow[] {
    const rows = this.stmtAdminSummaryByRole.all(from, to) as Record<string, unknown>[];
    return rows.map((r) => adminRoleRowSchema.parse(r));
  }

  getAdminUsers(from: string, to: string, limit: number = 50): AdminUserRow[] {
    const rows = this.stmtAdminUsers.all(from, to, limit) as Record<string, unknown>[];
    return rows.map((r) => adminUserRowSchema.parse(r));
  }

  getAdminTrend(from: string, to: string): TrendRow[] {
    const rows = this.stmtAdminTrend.all(from, to) as Record<string, unknown>[];
    return rows.map((r) => trendRowSchema.parse(r));
  }

  getExportData(from: string, to: string): ExportRow[] {
    const rows = this.stmtExportData.all(from, to) as Record<string, unknown>[];
    return rows.map((r) => exportRowSchema.parse(r));
  }
}
