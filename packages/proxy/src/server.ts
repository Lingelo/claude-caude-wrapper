import { dirname, resolve } from "node:path";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import Fastify from "fastify";
import fastifyStatic from "@fastify/static";
import type { Config } from "./config.js";
import { initAuth, authMiddleware } from "./middleware/auth.js";
import { rateLimitMiddleware } from "./middleware/rate-limit.js";
import { logRequest } from "./middleware/request-logger.js";
import { registerHealthRoutes } from "./routes/health.js";
import { registerMessageRoutes } from "./routes/messages.js";
import { registerCountTokensRoutes } from "./routes/count-tokens.js";
import { registerDashboardRoutes } from "./routes/dashboard.js";
import { AnthropicForwarder } from "./services/anthropic-forwarder.js";
import { KeyRouter } from "./services/key-router.js";
import { UsageTracker } from "./services/usage-tracker.js";
import { DashboardQueries } from "./services/dashboard-queries.js";
import { initDb } from "./db/sqlite.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

export async function createServer(config: Config) {
  const app = Fastify({
    logger: {
      level: config.logLevel,
    },
    // Don't parse body as JSON by default — we need raw body for forwarding
    // but also need to read `stream` and `model` fields
    bodyLimit: 10 * 1024 * 1024, // 10MB
  });

  // Initialize components
  initAuth(config);
  const db = initDb(config.databasePath);
  const keyRouter = new KeyRouter(config.roleKeys);
  const usageTracker = new UsageTracker(db);
  const forwarder = new AnthropicForwarder(config, keyRouter, usageTracker);
  const dashboardQueries = new DashboardQueries(db);

  // Health routes (no auth)
  registerHealthRoutes(app);

  // Serve dashboard static files
  const dashboardRoot = resolve(__dirname, "../public/dashboard");
  await app.register(fastifyStatic, {
    root: dashboardRoot,
    prefix: "/dashboard/",
    decorateReply: false,
  });

  // Inject Auth0 config into dashboard index.html
  app.get("/dashboard", async (_request, reply) => {
    const indexPath = resolve(dashboardRoot, "index.html");
    let html = readFileSync(indexPath, "utf-8");
    const configScript = `<script>window.__DASHBOARD_CONFIG__=${JSON.stringify({
      auth0Domain: config.auth0Domain,
      auth0ClientId: config.auth0DashboardClientId ?? "",
      auth0Audience: config.auth0Audience,
    })};</script>`;
    html = html.replace("</head>", `${configScript}\n</head>`);
    return reply.type("text/html").send(html);
  });

  // SPA fallback for dashboard client-side routing
  app.get("/dashboard/*", async (request, reply) => {
    // Let static files pass through (already handled by @fastify/static)
    // This catches unmatched routes for SPA history fallback
    const indexPath = resolve(dashboardRoot, "index.html");
    let html = readFileSync(indexPath, "utf-8");
    const configScript = `<script>window.__DASHBOARD_CONFIG__=${JSON.stringify({
      auth0Domain: config.auth0Domain,
      auth0ClientId: config.auth0DashboardClientId ?? "",
      auth0Audience: config.auth0Audience,
    })};</script>`;
    html = html.replace("</head>", `${configScript}\n</head>`);
    return reply.type("text/html").send(html);
  });

  // Auth + rate limit for /v1/* routes
  app.addHook("onRequest", async (request, reply) => {
    if (!request.url.startsWith("/v1/")) return;

    await authMiddleware(request, reply, config);
    if (reply.sent) return;

    logRequest(request);

    const allowed = rateLimitMiddleware(request, reply, config.rateLimitRpm);
    if (!allowed) return;
  });

  // Auth for /api/dashboard/* routes (no rate limit — read-only dashboard)
  app.addHook("onRequest", async (request, reply) => {
    if (!request.url.startsWith("/api/dashboard/")) return;

    await authMiddleware(request, reply, config);
  });

  // Proxy routes
  registerMessageRoutes(app, forwarder);
  registerCountTokensRoutes(app, forwarder);

  // Dashboard API routes
  registerDashboardRoutes(app, dashboardQueries);

  return app;
}
