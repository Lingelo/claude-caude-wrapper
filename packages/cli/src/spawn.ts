import { spawn } from "node:child_process";
import { logStep, logDetail, logSuccess } from "./ui.js";

export function spawnClaude(
  proxyUrl: string,
  accessToken: string,
  args: string[]
): Promise<number> {
  logStep("proxy", "Connecting through enterprise proxy");
  logDetail(`Proxy: ${proxyUrl}`);
  logStep("launch", "Launching Claude Code...");
  console.log();

  return new Promise((resolve, reject) => {
    const child = spawn("claude", args, {
      stdio: "inherit",
      env: {
        ...process.env,
        ANTHROPIC_BASE_URL: proxyUrl,
        ANTHROPIC_AUTH_TOKEN: accessToken,
      },
    });

    // Forward signals to child
    const forwardSignal = (signal: NodeJS.Signals) => {
      child.kill(signal);
    };
    process.on("SIGINT", () => forwardSignal("SIGINT"));
    process.on("SIGTERM", () => forwardSignal("SIGTERM"));

    child.on("error", (err) => {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") {
        reject(
          new Error(
            "Claude Code CLI not found. Please install it first: npm install -g @anthropic-ai/claude-code"
          )
        );
      } else {
        reject(err);
      }
    });

    child.on("exit", (code, signal) => {
      if (signal) {
        process.kill(process.pid, signal);
      } else {
        resolve(code ?? 1);
      }
    });
  });
}
