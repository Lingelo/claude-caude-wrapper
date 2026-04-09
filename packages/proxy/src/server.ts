import Fastify from "fastify";
import type { Config } from "./config.js";
import { initAuth, authMiddleware } from "./middleware/auth.js";
import { rateLimitMiddleware } from "./middleware/rate-limit.js";
import { logRequest } from "./middleware/request-logger.js";
import { registerHealthRoutes } from "./routes/health.js";
import { registerMessageRoutes } from "./routes/messages.js";
import { registerCountTokensRoutes } from "./routes/count-tokens.js";
import { AnthropicForwarder } from "./services/anthropic-forwarder.js";
import { KeyRouter } from "./services/key-router.js";
import { UsageTracker } from "./services/usage-tracker.js";
import { initDb } from "./db/sqlite.js";

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

  // Health routes (no auth)
  registerHealthRoutes(app);

  // Auth + rate limit for /v1/* routes
  app.addHook("onRequest", async (request, reply) => {
    if (!request.url.startsWith("/v1/")) return;

    await authMiddleware(request, reply, config);
    if (reply.sent) return;

    logRequest(request);

    const allowed = rateLimitMiddleware(request, reply, config.rateLimitRpm);
    if (!allowed) return;
  });

  // Proxy routes
  registerMessageRoutes(app, forwarder);
  registerCountTokensRoutes(app, forwarder);

  return app;
}
