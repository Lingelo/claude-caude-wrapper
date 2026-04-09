import type { FastifyRequest, FastifyReply } from "fastify";
import type { UserContext } from "../types.js";

interface RateLimitEntry {
  count: number;
  windowStart: number;
}

const limits = new Map<string, RateLimitEntry>();

const WINDOW_MS = 60_000; // 1 minute

export function rateLimitMiddleware(
  request: FastifyRequest,
  reply: FastifyReply,
  maxRpm: number
): boolean {
  const user = (request as FastifyRequest & { user: UserContext }).user;
  if (!user) return true;

  const key = user.sub;
  const now = Date.now();
  const entry = limits.get(key);

  if (!entry || now - entry.windowStart > WINDOW_MS) {
    limits.set(key, { count: 1, windowStart: now });
    return true;
  }

  entry.count++;

  if (entry.count > maxRpm) {
    const retryAfter = Math.ceil(
      (entry.windowStart + WINDOW_MS - now) / 1000
    );
    reply.code(429).send({
      error: "rate_limit_exceeded",
      message: `Rate limit of ${maxRpm} requests per minute exceeded. Retry after ${retryAfter}s.`,
      retry_after_seconds: retryAfter,
    });
    return false;
  }

  return true;
}
