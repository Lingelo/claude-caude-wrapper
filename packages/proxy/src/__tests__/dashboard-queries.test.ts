import { describe, it, expect, beforeEach } from "vitest";
import { DashboardQueries } from "../services/dashboard-queries.js";
import { createTestDb, seedUsageData } from "./test-helpers.js";
import type Database from "better-sqlite3";

describe("DashboardQueries", () => {
  let db: Database.Database;
  let queries: DashboardQueries;

  beforeEach(() => {
    db = createTestDb();
    queries = new DashboardQueries(db);

    seedUsageData(db, [
      // User A — developer, two days, two models
      {
        user_sub: "auth0|user-a",
        user_email: "a@test.com",
        user_role: "developer",
        model: "claude-sonnet-4-6",
        input_tokens: 1000,
        output_tokens: 500,
        cache_creation_input_tokens: 100,
        cache_read_input_tokens: 200,
        timestamp: "2026-04-01T10:00:00Z",
      },
      {
        user_sub: "auth0|user-a",
        user_email: "a@test.com",
        user_role: "developer",
        model: "claude-sonnet-4-6",
        input_tokens: 2000,
        output_tokens: 1000,
        cache_creation_input_tokens: 150,
        cache_read_input_tokens: 300,
        timestamp: "2026-04-02T10:00:00Z",
      },
      {
        user_sub: "auth0|user-a",
        user_email: "a@test.com",
        user_role: "developer",
        model: "claude-opus-4-6",
        input_tokens: 500,
        output_tokens: 250,
        timestamp: "2026-04-02T14:00:00Z",
      },
      // User B — tech-lead
      {
        user_sub: "auth0|user-b",
        user_email: "b@test.com",
        user_role: "tech-lead",
        model: "claude-opus-4-6",
        input_tokens: 5000,
        output_tokens: 3000,
        cache_creation_input_tokens: 500,
        cache_read_input_tokens: 1000,
        timestamp: "2026-04-01T12:00:00Z",
      },
      // User C — po
      {
        user_sub: "auth0|user-c",
        user_email: "c@test.com",
        user_role: "po",
        model: "claude-sonnet-4-6",
        input_tokens: 800,
        output_tokens: 400,
        timestamp: "2026-04-03T09:00:00Z",
      },
    ]);
  });

  // --- Personal queries ---

  describe("getPersonalSummary", () => {
    it("returns aggregated totals for a user", () => {
      const result = queries.getPersonalSummary(
        "auth0|user-a",
        "2026-04-01",
        "2026-04-10"
      );
      expect(result.request_count).toBe(3);
      expect(result.total_input).toBe(3500); // 1000+2000+500
      expect(result.total_output).toBe(1750); // 500+1000+250
      expect(result.total_cache_creation).toBe(250); // 100+150
      expect(result.total_cache_read).toBe(500); // 200+300
    });

    it("returns zeros for unknown user", () => {
      const result = queries.getPersonalSummary(
        "auth0|nobody",
        "2026-04-01",
        "2026-04-10"
      );
      expect(result.request_count).toBe(0);
      expect(result.total_input).toBe(0);
    });

    it("respects date range filtering", () => {
      const result = queries.getPersonalSummary(
        "auth0|user-a",
        "2026-04-02",
        "2026-04-03"
      );
      expect(result.request_count).toBe(2); // only April 2nd
      expect(result.total_input).toBe(2500); // 2000+500
    });
  });

  describe("getPersonalDaily", () => {
    it("returns daily breakdown grouped by date", () => {
      const days = queries.getPersonalDaily(
        "auth0|user-a",
        "2026-04-01",
        "2026-04-10"
      );
      expect(days).toHaveLength(2);
      expect(days[0].day).toBe("2026-04-01");
      expect(days[0].input).toBe(1000);
      expect(days[0].requests).toBe(1);
      expect(days[1].day).toBe("2026-04-02");
      expect(days[1].input).toBe(2500);
      expect(days[1].requests).toBe(2);
    });

    it("returns empty array for no data", () => {
      const days = queries.getPersonalDaily(
        "auth0|nobody",
        "2026-04-01",
        "2026-04-10"
      );
      expect(days).toHaveLength(0);
    });
  });

  describe("getPersonalModels", () => {
    it("returns per-model breakdown sorted by total tokens desc", () => {
      const models = queries.getPersonalModels(
        "auth0|user-a",
        "2026-04-01",
        "2026-04-10"
      );
      expect(models).toHaveLength(2);
      expect(models[0].model).toBe("claude-sonnet-4-6");
      expect(models[0].input).toBe(3000); // 1000+2000
      expect(models[1].model).toBe("claude-opus-4-6");
      expect(models[1].input).toBe(500);
    });
  });

  // --- Admin queries ---

  describe("getAdminSummaryByRole", () => {
    it("returns aggregated data grouped by role", () => {
      const roles = queries.getAdminSummaryByRole("2026-04-01", "2026-04-10");
      expect(roles).toHaveLength(3);

      const dev = roles.find((r) => r.user_role === "developer")!;
      expect(dev.user_count).toBe(1);
      expect(dev.total_input).toBe(3500);
      expect(dev.request_count).toBe(3);

      const lead = roles.find((r) => r.user_role === "tech-lead")!;
      expect(lead.user_count).toBe(1);
      expect(lead.total_input).toBe(5000);
    });
  });

  describe("getAdminUsers", () => {
    it("returns users ranked by total tokens descending", () => {
      const users = queries.getAdminUsers("2026-04-01", "2026-04-10", 50);
      expect(users).toHaveLength(3);
      expect(users[0].user_email).toBe("b@test.com"); // 5000+3000 = 8000
      expect(users[0].total_tokens).toBe(8000);
      expect(users[1].user_email).toBe("a@test.com"); // 3500+1750 = 5250
    });

    it("respects limit parameter", () => {
      const users = queries.getAdminUsers("2026-04-01", "2026-04-10", 1);
      expect(users).toHaveLength(1);
      expect(users[0].user_email).toBe("b@test.com");
    });
  });

  describe("getAdminTrend", () => {
    it("returns daily trend with active user count", () => {
      const trend = queries.getAdminTrend("2026-04-01", "2026-04-10");
      expect(trend).toHaveLength(3); // Apr 1, 2, 3

      const apr1 = trend[0];
      expect(apr1.day).toBe("2026-04-01");
      expect(apr1.active_users).toBe(2); // user-a and user-b
      expect(apr1.input).toBe(6000); // 1000+5000
    });
  });

  describe("getExportData", () => {
    it("returns rows aggregated by date+user+model", () => {
      const rows = queries.getExportData("2026-04-01", "2026-04-10");
      expect(rows.length).toBeGreaterThanOrEqual(4);

      const firstRow = rows[0];
      expect(firstRow).toHaveProperty("day");
      expect(firstRow).toHaveProperty("user_email");
      expect(firstRow).toHaveProperty("model");
      expect(firstRow).toHaveProperty("input_tokens");
      expect(firstRow).toHaveProperty("request_count");
    });
  });
});
