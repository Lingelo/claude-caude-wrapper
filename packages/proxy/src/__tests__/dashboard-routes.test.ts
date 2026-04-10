import { describe, it, expect, beforeAll, afterAll } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import { DashboardQueries } from "../services/dashboard-queries.js";
import { registerDashboardRoutes } from "../routes/dashboard.js";
import { createTestDb, seedUsageData } from "./test-helpers.js";
import type Database from "better-sqlite3";
import type { UserContext } from "../types.js";

// Minimal Fastify test server with mock auth — bypasses Auth0 JWKS
function createTestServer(
  db: Database.Database,
  defaultUser: UserContext
): FastifyInstance {
  const app = Fastify({ logger: false });
  const queries = new DashboardQueries(db);

  // Mock auth hook: inject user from header or use default
  app.addHook("onRequest", async (request, reply) => {
    if (!request.url.startsWith("/api/dashboard/")) return;

    const mockRole = request.headers["x-test-role"] as string | undefined;
    const mockSub = request.headers["x-test-sub"] as string | undefined;
    const authHeader = request.headers.authorization;

    if (authHeader === "Bearer INVALID") {
      reply.code(401).send({ error: "unauthorized", message: "Invalid token" });
      return;
    }

    if (!authHeader) {
      reply.code(401).send({ error: "unauthorized", message: "Missing token" });
      return;
    }

    const user: UserContext = {
      sub: mockSub ?? defaultUser.sub,
      email: defaultUser.email,
      role: mockRole ?? defaultUser.role,
    };

    (request as any).user = user;
  });

  registerDashboardRoutes(app, queries);

  return app;
}

describe("Dashboard Routes", () => {
  let db: Database.Database;
  let app: FastifyInstance;

  beforeAll(async () => {
    db = createTestDb();
    seedUsageData(db, [
      {
        user_sub: "auth0|alice",
        user_email: "alice@test.com",
        user_role: "developer",
        model: "claude-sonnet-4-6",
        input_tokens: 1000,
        output_tokens: 500,
        cache_creation_input_tokens: 100,
        cache_read_input_tokens: 200,
        timestamp: "2026-04-05T10:00:00Z",
      },
      {
        user_sub: "auth0|alice",
        user_email: "alice@test.com",
        user_role: "developer",
        model: "claude-opus-4-6",
        input_tokens: 2000,
        output_tokens: 1000,
        timestamp: "2026-04-06T10:00:00Z",
      },
      {
        user_sub: "auth0|bob",
        user_email: "bob@test.com",
        user_role: "tech-lead",
        model: "claude-opus-4-6",
        input_tokens: 5000,
        output_tokens: 3000,
        cache_creation_input_tokens: 500,
        cache_read_input_tokens: 1000,
        timestamp: "2026-04-05T12:00:00Z",
      },
    ]);

    app = createTestServer(db, {
      sub: "auth0|alice",
      email: "alice@test.com",
      role: "developer",
    });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    db.close();
  });

  // --- Auth checks ---

  describe("authentication", () => {
    it("returns 401 without Authorization header", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/dashboard/me/summary",
      });
      expect(res.statusCode).toBe(401);
      expect(res.json().error).toBe("unauthorized");
    });

    it("returns 401 with invalid token", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/dashboard/me/summary",
        headers: { authorization: "Bearer INVALID" },
      });
      expect(res.statusCode).toBe(401);
    });
  });

  // --- Personal endpoints ---

  describe("GET /api/dashboard/me/summary", () => {
    it("returns personal usage summary", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/dashboard/me/summary?from=2026-04-01&to=2026-04-10",
        headers: { authorization: "Bearer valid" },
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.user_sub).toBe("auth0|alice");
      expect(body.user_email).toBe("alice@test.com");
      expect(body.period).toEqual({ from: "2026-04-01", to: "2026-04-10" });
      expect(body.summary.request_count).toBe(2);
      expect(body.summary.input_tokens).toBe(3000);
      expect(body.summary.output_tokens).toBe(1500);
      expect(body.summary.cache_creation_input_tokens).toBe(100);
      expect(body.summary.cache_read_input_tokens).toBe(200);
    });

    it("returns 400 for date range exceeding 90 days", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/dashboard/me/summary?from=2026-01-01&to=2026-06-01",
        headers: { authorization: "Bearer valid" },
      });
      expect(res.statusCode).toBe(400);
      expect(res.json().error).toBe("bad_request");
    });

    it("returns 400 for invalid date format", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/dashboard/me/summary?from=not-a-date",
        headers: { authorization: "Bearer valid" },
      });
      expect(res.statusCode).toBe(400);
    });
  });

  describe("GET /api/dashboard/me/daily", () => {
    it("returns daily breakdown", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/dashboard/me/daily?from=2026-04-01&to=2026-04-10",
        headers: { authorization: "Bearer valid" },
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.days).toHaveLength(2);
      expect(body.days[0].date).toBe("2026-04-05");
      expect(body.days[0].input_tokens).toBe(1000);
      expect(body.days[0].cache_creation_input_tokens).toBe(100);
    });
  });

  describe("GET /api/dashboard/me/models", () => {
    it("returns per-model breakdown", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/dashboard/me/models?from=2026-04-01&to=2026-04-10",
        headers: { authorization: "Bearer valid" },
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.models).toHaveLength(2);
      expect(body.models[0].model).toBe("claude-opus-4-6"); // highest total
    });
  });

  // --- Admin endpoints ---

  describe("admin authorization", () => {
    it("returns 403 for non-admin user on admin endpoint", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/dashboard/admin/summary?from=2026-04-01&to=2026-04-10",
        headers: {
          authorization: "Bearer valid",
          "x-test-role": "developer",
        },
      });
      expect(res.statusCode).toBe(403);
      expect(res.json().error).toBe("forbidden");
    });
  });

  describe("GET /api/dashboard/admin/summary", () => {
    it("returns aggregated summary for admin", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/dashboard/admin/summary?from=2026-04-01&to=2026-04-10",
        headers: {
          authorization: "Bearer valid",
          "x-test-role": "tech-lead",
        },
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.total.request_count).toBe(3);
      expect(body.total.active_users).toBe(2);
      expect(body.by_role).toHaveLength(2); // developer + tech-lead
    });
  });

  describe("GET /api/dashboard/admin/users", () => {
    it("returns user ranking for admin", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/dashboard/admin/users?from=2026-04-01&to=2026-04-10",
        headers: {
          authorization: "Bearer valid",
          "x-test-role": "tech-lead",
        },
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.users).toHaveLength(2);
      expect(body.users[0].user_email).toBe("bob@test.com"); // highest
      expect(body.users[0].total_tokens).toBe(8000);
    });

    it("respects limit parameter", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/dashboard/admin/users?from=2026-04-01&to=2026-04-10&limit=1",
        headers: {
          authorization: "Bearer valid",
          "x-test-role": "tech-lead",
        },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().users).toHaveLength(1);
    });
  });

  describe("GET /api/dashboard/admin/trend", () => {
    it("returns daily trend for admin", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/dashboard/admin/trend?from=2026-04-01&to=2026-04-10",
        headers: {
          authorization: "Bearer valid",
          "x-test-role": "tech-lead",
        },
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.days).toHaveLength(2);
      expect(body.days[0].active_users).toBe(2); // alice + bob on Apr 5
    });

    it("returns 403 for non-admin", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/dashboard/admin/trend?from=2026-04-01&to=2026-04-10",
        headers: {
          authorization: "Bearer valid",
          "x-test-role": "po",
        },
      });
      expect(res.statusCode).toBe(403);
    });
  });

  describe("GET /api/dashboard/admin/export", () => {
    it("returns CSV with correct content-type and headers", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/dashboard/admin/export?from=2026-04-01&to=2026-04-10",
        headers: {
          authorization: "Bearer valid",
          "x-test-role": "tech-lead",
        },
      });
      expect(res.statusCode).toBe(200);
      expect(res.headers["content-type"]).toContain("text/csv");
      expect(res.headers["content-disposition"]).toBe(
        "attachment; filename=usage-export-2026-04-01-to-2026-04-10.csv"
      );

      const lines = res.body.split("\n");
      expect(lines[0]).toBe(
        "date,user_email,user_role,model,input_tokens,output_tokens,cache_creation_input_tokens,cache_read_input_tokens,request_count"
      );
      expect(lines.length).toBeGreaterThan(1);
    });

    it("returns 403 for non-admin", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/dashboard/admin/export?from=2026-04-01&to=2026-04-10",
        headers: {
          authorization: "Bearer valid",
          "x-test-role": "developer",
        },
      });
      expect(res.statusCode).toBe(403);
    });
  });
});
