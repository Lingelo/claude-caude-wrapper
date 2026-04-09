import { request as undiciRequest } from "undici";
import type { FastifyRequest, FastifyReply } from "fastify";
import type { Config } from "../config.js";
import type { UserContext, UsageRecord, StreamUsageResult } from "../types.js";
import { StreamUsageParser } from "./stream-handler.js";
import { KeyRouter } from "./key-router.js";
import { UsageTracker } from "./usage-tracker.js";

const FORWARD_HEADERS = [
  "anthropic-beta",
  "anthropic-version",
  "content-type",
  "x-claude-code-session-id",
] as const;

export class AnthropicForwarder {
  constructor(
    private readonly config: Config,
    private readonly keyRouter: KeyRouter,
    private readonly usageTracker: UsageTracker
  ) {}

  async forward(
    request: FastifyRequest,
    reply: FastifyReply,
    endpoint: string
  ): Promise<void> {
    const user = (request as FastifyRequest & { user: UserContext }).user;
    const apiKey = this.keyRouter.getApiKey(user.role);
    const startTime = Date.now();
    const sessionId =
      (request.headers["x-claude-code-session-id"] as string) ?? null;

    // Build upstream headers
    const upstreamHeaders: Record<string, string> = {
      "x-api-key": apiKey,
    };
    for (const header of FORWARD_HEADERS) {
      const value = request.headers[header];
      if (value && typeof value === "string") {
        upstreamHeaders[header] = value;
      }
    }

    const body = request.body as Record<string, unknown>;
    const model = (body?.model as string) ?? "unknown";
    const isStreaming = body?.stream === true;
    const bodyString = JSON.stringify(body);

    const upstreamUrl = `${this.config.anthropicUpstreamUrl}${endpoint}`;

    try {
      const response = await undiciRequest(upstreamUrl, {
        method: "POST",
        headers: upstreamHeaders,
        body: bodyString,
      });

      const durationMs = Date.now() - startTime;

      if (isStreaming && response.statusCode === 200) {
        await this.handleStreaming(
          request,
          reply,
          response,
          user,
          sessionId,
          endpoint,
          model,
          durationMs
        );
      } else {
        await this.handleNonStreaming(
          reply,
          response,
          user,
          sessionId,
          endpoint,
          model,
          durationMs
        );
      }
    } catch (err) {
      const durationMs = Date.now() - startTime;
      const message =
        err instanceof Error ? err.message : "Upstream request failed";

      this.recordUsage(user, sessionId, endpoint, model, {
        input_tokens: 0,
        output_tokens: 0,
        cache_creation_input_tokens: 0,
        cache_read_input_tokens: 0,
      }, durationMs, 502, message);

      reply.code(502).send({
        error: "upstream_error",
        message,
      });
    }
  }

  private async handleNonStreaming(
    reply: FastifyReply,
    response: Awaited<ReturnType<typeof undiciRequest>>,
    user: UserContext,
    sessionId: string | null,
    endpoint: string,
    model: string,
    startDuration: number
  ): Promise<void> {
    const responseBody = await response.body.text();
    const durationMs = Date.now() - (Date.now() - startDuration);

    // Forward response headers
    reply.code(response.statusCode);
    const contentType = response.headers["content-type"];
    if (contentType) {
      reply.header("content-type", contentType);
    }

    // Extract usage from response
    let usage: StreamUsageResult = {
      input_tokens: 0,
      output_tokens: 0,
      cache_creation_input_tokens: 0,
      cache_read_input_tokens: 0,
    };

    try {
      const parsed = JSON.parse(responseBody);
      if (parsed.usage) {
        usage = {
          input_tokens: parsed.usage.input_tokens ?? 0,
          output_tokens: parsed.usage.output_tokens ?? 0,
          cache_creation_input_tokens:
            parsed.usage.cache_creation_input_tokens ?? 0,
          cache_read_input_tokens:
            parsed.usage.cache_read_input_tokens ?? 0,
        };
      }
    } catch {
      // Response might not be JSON
    }

    this.recordUsage(
      user,
      sessionId,
      endpoint,
      model,
      usage,
      startDuration,
      response.statusCode,
      response.statusCode >= 400 ? responseBody : null
    );

    reply.send(responseBody);
  }

  private async handleStreaming(
    request: FastifyRequest,
    reply: FastifyReply,
    response: Awaited<ReturnType<typeof undiciRequest>>,
    user: UserContext,
    sessionId: string | null,
    endpoint: string,
    model: string,
    startDuration: number
  ): Promise<void> {
    const parser = new StreamUsageParser();

    // Set streaming headers
    reply.raw.writeHead(200, {
      "content-type": "text/event-stream",
      "cache-control": "no-cache",
      connection: "keep-alive",
    });

    const decoder = new TextDecoder();

    try {
      for await (const chunk of response.body) {
        const text = decoder.decode(chunk as Buffer, { stream: true });
        parser.processChunk(text);
        reply.raw.write(chunk);
      }
    } finally {
      const durationMs = Date.now() - (Date.now() - startDuration);
      this.recordUsage(
        user,
        sessionId,
        endpoint,
        model,
        parser.getUsage(),
        startDuration,
        200,
        null
      );
      reply.raw.end();
    }
  }

  private recordUsage(
    user: UserContext,
    sessionId: string | null,
    endpoint: string,
    model: string,
    usage: StreamUsageResult,
    durationMs: number,
    statusCode: number,
    errorMessage: string | null
  ): void {
    try {
      this.usageTracker.record({
        user_sub: user.sub,
        user_email: user.email,
        user_role: user.role,
        session_id: sessionId,
        endpoint,
        model,
        input_tokens: usage.input_tokens,
        output_tokens: usage.output_tokens,
        cache_creation_input_tokens: usage.cache_creation_input_tokens,
        cache_read_input_tokens: usage.cache_read_input_tokens,
        request_duration_ms: durationMs,
        status_code: statusCode,
        error_message: errorMessage,
      });
    } catch (err) {
      // Don't fail the request if usage tracking fails
      console.error("Failed to record usage:", err);
    }
  }
}
