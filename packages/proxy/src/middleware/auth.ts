import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";
import type { FastifyRequest, FastifyReply } from "fastify";
import type { Config } from "../config.js";
import type { UserContext } from "../types.js";

let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

export function initAuth(config: Config) {
  const jwksUrl = new URL(
    `https://${config.auth0Domain}/.well-known/jwks.json`
  );
  jwks = createRemoteJWKSet(jwksUrl);
}

export async function authMiddleware(
  request: FastifyRequest,
  reply: FastifyReply,
  config: Config
): Promise<void> {
  const authHeader = request.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    reply.code(401).send({
      error: "invalid_token",
      message: "Missing or malformed Authorization header. Expected: Bearer <JWT>",
    });
    return;
  }

  const token = authHeader.slice(7);

  if (!jwks) {
    reply.code(500).send({
      error: "server_error",
      message: "Auth not initialized",
    });
    return;
  }

  try {
    const { payload } = await jwtVerify(token, jwks, {
      issuer: `https://${config.auth0Domain}/`,
      audience: config.auth0Audience,
    });

    const namespace = config.auth0Audience;
    const user: UserContext = {
      sub: payload.sub ?? "unknown",
      email:
        (payload as Record<string, unknown>)[`${namespace}/email`] as string ??
        (payload as Record<string, unknown>)["email"] as string ??
        "unknown",
      role:
        (payload as Record<string, unknown>)[`${namespace}/role`] as string ??
        "default",
    };

    (request as FastifyRequest & { user: UserContext }).user = user;
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Token verification failed";
    reply.code(401).send({
      error: "invalid_token",
      message,
    });
  }
}
