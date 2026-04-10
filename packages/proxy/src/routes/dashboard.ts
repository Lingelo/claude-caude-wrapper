import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import type { DashboardQueries } from "../services/dashboard-queries.js";
import type { UserContext } from "../types.js";

const dateRangeSchema = z.object({
  from: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Must be ISO date (YYYY-MM-DD)")
    .optional(),
  to: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Must be ISO date (YYYY-MM-DD)")
    .optional(),
});

const limitSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

function getDefaultPeriod(): { from: string; to: string } {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1)
    .toISOString()
    .slice(0, 10);
  const to = new Date(now.getTime() + 86400000).toISOString().slice(0, 10);
  return { from, to };
}

function parsePeriod(query: Record<string, unknown>): {
  from: string;
  to: string;
} {
  const parsed = dateRangeSchema.parse(query);
  const defaults = getDefaultPeriod();
  const from = parsed.from ?? defaults.from;
  const to = parsed.to ?? defaults.to;

  const fromDate = new Date(from);
  const toDate = new Date(to);
  const diffDays =
    (toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24);

  if (diffDays > 90) {
    throw new DateRangeError("Date range exceeds 90 days");
  }
  if (diffDays < 0) {
    throw new DateRangeError("'from' must be before 'to'");
  }

  return { from, to };
}

class DateRangeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DateRangeError";
  }
}

function getUser(request: FastifyRequest): UserContext {
  return (request as FastifyRequest & { user: UserContext }).user;
}

function isAdmin(request: FastifyRequest): boolean {
  return getUser(request).role === "tech-lead";
}

export function registerDashboardRoutes(
  app: FastifyInstance,
  queries: DashboardQueries
): void {
  // --- Personal endpoints ---

  app.get("/api/dashboard/me/summary", async (request, reply) => {
    try {
      const user = getUser(request);
      const { from, to } = parsePeriod(
        request.query as Record<string, unknown>
      );
      const summary = queries.getPersonalSummary(user.sub, from, to);
      return {
        user_sub: user.sub,
        user_email: user.email,
        user_role: user.role,
        period: { from, to },
        summary: {
          request_count: summary.request_count,
          input_tokens: summary.total_input,
          output_tokens: summary.total_output,
          cache_creation_input_tokens: summary.total_cache_creation,
          cache_read_input_tokens: summary.total_cache_read,
        },
      };
    } catch (err) {
      return handleError(err, reply);
    }
  });

  app.get("/api/dashboard/me/daily", async (request, reply) => {
    try {
      const user = getUser(request);
      const { from, to } = parsePeriod(
        request.query as Record<string, unknown>
      );
      const days = queries.getPersonalDaily(user.sub, from, to);
      return {
        period: { from, to },
        days: days.map((d) => ({
          date: d.day,
          input_tokens: d.input,
          output_tokens: d.output,
          cache_creation_input_tokens: d.cache_creation,
          cache_read_input_tokens: d.cache_read,
          request_count: d.requests,
        })),
      };
    } catch (err) {
      return handleError(err, reply);
    }
  });

  app.get("/api/dashboard/me/models", async (request, reply) => {
    try {
      const user = getUser(request);
      const { from, to } = parsePeriod(
        request.query as Record<string, unknown>
      );
      const models = queries.getPersonalModels(user.sub, from, to);
      return {
        period: { from, to },
        models: models.map((m) => ({
          model: m.model,
          input_tokens: m.input,
          output_tokens: m.output,
          cache_creation_input_tokens: m.cache_creation,
          cache_read_input_tokens: m.cache_read,
          request_count: m.requests,
        })),
      };
    } catch (err) {
      return handleError(err, reply);
    }
  });

  // --- Admin endpoints ---

  app.get("/api/dashboard/admin/summary", async (request, reply) => {
    if (!isAdmin(request)) {
      return reply
        .code(403)
        .send({ error: "forbidden", message: "Admin access required" });
    }

    try {
      const { from, to } = parsePeriod(
        request.query as Record<string, unknown>
      );
      const byRole = queries.getAdminSummaryByRole(from, to);

      const total = byRole.reduce(
        (acc, r) => ({
          request_count: acc.request_count + r.request_count,
          input_tokens: acc.input_tokens + r.total_input,
          output_tokens: acc.output_tokens + r.total_output,
          cache_creation_input_tokens:
            acc.cache_creation_input_tokens + r.total_cache_creation,
          cache_read_input_tokens:
            acc.cache_read_input_tokens + r.total_cache_read,
          active_users: acc.active_users + r.user_count,
        }),
        {
          request_count: 0,
          input_tokens: 0,
          output_tokens: 0,
          cache_creation_input_tokens: 0,
          cache_read_input_tokens: 0,
          active_users: 0,
        }
      );

      return {
        period: { from, to },
        total,
        by_role: byRole.map((r) => ({
          role: r.user_role,
          user_count: r.user_count,
          request_count: r.request_count,
          input_tokens: r.total_input,
          output_tokens: r.total_output,
          cache_creation_input_tokens: r.total_cache_creation,
          cache_read_input_tokens: r.total_cache_read,
        })),
      };
    } catch (err) {
      return handleError(err, reply);
    }
  });

  app.get("/api/dashboard/admin/users", async (request, reply) => {
    if (!isAdmin(request)) {
      return reply
        .code(403)
        .send({ error: "forbidden", message: "Admin access required" });
    }

    try {
      const query = request.query as Record<string, unknown>;
      const { from, to } = parsePeriod(query);
      const { limit } = limitSchema.parse(query);
      const users = queries.getAdminUsers(from, to, limit);

      return {
        period: { from, to },
        users: users.map((u) => ({
          user_sub: u.user_sub,
          user_email: u.user_email,
          user_role: u.user_role,
          total_tokens: u.total_tokens,
          input_tokens: u.total_input,
          output_tokens: u.total_output,
          cache_creation_input_tokens: u.total_cache_creation,
          cache_read_input_tokens: u.total_cache_read,
          request_count: u.request_count,
        })),
      };
    } catch (err) {
      return handleError(err, reply);
    }
  });

  app.get("/api/dashboard/admin/trend", async (request, reply) => {
    if (!isAdmin(request)) {
      return reply
        .code(403)
        .send({ error: "forbidden", message: "Admin access required" });
    }

    try {
      const { from, to } = parsePeriod(
        request.query as Record<string, unknown>
      );
      const days = queries.getAdminTrend(from, to);

      return {
        period: { from, to },
        days: days.map((d) => ({
          date: d.day,
          input_tokens: d.input,
          output_tokens: d.output,
          cache_creation_input_tokens: d.cache_creation,
          cache_read_input_tokens: d.cache_read,
          request_count: d.requests,
          active_users: d.active_users,
        })),
      };
    } catch (err) {
      return handleError(err, reply);
    }
  });

  app.get("/api/dashboard/admin/export", async (request, reply) => {
    if (!isAdmin(request)) {
      return reply
        .code(403)
        .send({ error: "forbidden", message: "Admin access required" });
    }

    try {
      const { from, to } = parsePeriod(
        request.query as Record<string, unknown>
      );
      const rows = queries.getExportData(from, to);

      const header =
        "date,user_email,user_role,model,input_tokens,output_tokens,cache_creation_input_tokens,cache_read_input_tokens,request_count";
      const csvRows = rows.map(
        (r) =>
          `${r.day},${r.user_email},${r.user_role},${r.model},${r.input_tokens},${r.output_tokens},${r.cache_creation_input_tokens},${r.cache_read_input_tokens},${r.request_count}`
      );
      const csv = [header, ...csvRows].join("\n");

      return reply
        .header("Content-Type", "text/csv")
        .header(
          "Content-Disposition",
          `attachment; filename=usage-export-${from}-to-${to}.csv`
        )
        .send(csv);
    } catch (err) {
      return handleError(err, reply);
    }
  });
}

function handleError(err: unknown, reply: FastifyReply) {
  if (err instanceof DateRangeError) {
    return reply
      .code(400)
      .send({ error: "bad_request", message: err.message });
  }
  if (err instanceof z.ZodError) {
    return reply
      .code(400)
      .send({ error: "bad_request", message: err.errors[0]?.message ?? "Invalid parameters" });
  }
  throw err;
}
