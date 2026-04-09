import type { FastifyInstance } from "fastify";
import type { AnthropicForwarder } from "../services/anthropic-forwarder.js";

export function registerMessageRoutes(
  app: FastifyInstance,
  forwarder: AnthropicForwarder
): void {
  // Main messages endpoint (streaming & non-streaming)
  app.post("/v1/messages", async (request, reply) => {
    await forwarder.forward(request, reply, "/v1/messages");
  });
}
