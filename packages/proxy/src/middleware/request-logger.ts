import type { FastifyRequest } from "fastify";
import type { UserContext } from "../types.js";

export function logRequest(request: FastifyRequest): void {
  const user = (request as FastifyRequest & { user?: UserContext }).user;
  request.log.info(
    {
      method: request.method,
      url: request.url,
      userSub: user?.sub,
      userEmail: user?.email,
      userRole: user?.role,
      sessionId: request.headers["x-claude-code-session-id"],
    },
    "incoming request"
  );
}
