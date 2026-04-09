import type { FastifyInstance } from "fastify";
import type { AnthropicForwarder } from "../services/anthropic-forwarder.js";

export function registerCountTokensRoutes(
  app: FastifyInstance,
  forwarder: AnthropicForwarder
): void {
  app.post("/v1/messages/count_tokens", async (request, reply) => {
    await forwarder.forward(request, reply, "/v1/messages/count_tokens");
  });
}
