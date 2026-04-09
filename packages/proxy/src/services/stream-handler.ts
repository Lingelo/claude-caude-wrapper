import type { StreamUsageResult } from "../types.js";

/**
 * Parses SSE events from a streaming Anthropic response to extract usage data,
 * while passing through all bytes unchanged.
 */
export class StreamUsageParser {
  private buffer = "";
  private currentEvent = "";
  private usage: StreamUsageResult = {
    input_tokens: 0,
    output_tokens: 0,
    cache_creation_input_tokens: 0,
    cache_read_input_tokens: 0,
  };

  /**
   * Feed a chunk of SSE data. Returns the chunk unchanged (for forwarding).
   */
  processChunk(chunk: string): string {
    this.buffer += chunk;

    // Process complete lines
    const lines = this.buffer.split("\n");
    // Keep incomplete last line in buffer
    this.buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (line.startsWith("event: ")) {
        this.currentEvent = line.slice(7).trim();
      } else if (line.startsWith("data: ") && this.currentEvent) {
        this.parseEventData(this.currentEvent, line.slice(6));
      }
    }

    return chunk;
  }

  private parseEventData(eventType: string, data: string): void {
    try {
      const parsed = JSON.parse(data);

      if (eventType === "message_start" && parsed.message?.usage) {
        const u = parsed.message.usage;
        this.usage.input_tokens = u.input_tokens ?? 0;
        this.usage.cache_creation_input_tokens =
          u.cache_creation_input_tokens ?? 0;
        this.usage.cache_read_input_tokens = u.cache_read_input_tokens ?? 0;
      } else if (eventType === "message_delta" && parsed.usage) {
        this.usage.output_tokens = parsed.usage.output_tokens ?? 0;
      }
    } catch {
      // Not valid JSON data line, skip
    }
  }

  getUsage(): StreamUsageResult {
    return { ...this.usage };
  }
}
