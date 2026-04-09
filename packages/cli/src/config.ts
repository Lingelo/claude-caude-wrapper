import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { z } from "zod";

const CONFIG_DIR = join(homedir(), ".claude-enterprise");
const CONFIG_FILE = join(CONFIG_DIR, "config.json");

const configSchema = z.object({
  auth0Domain: z.string().min(1),
  auth0ClientId: z.string().min(1),
  auth0Audience: z.string().min(1),
  proxyUrl: z.string().url(),
});

export type CliConfig = z.infer<typeof configSchema>;

export function getConfigDir(): string {
  return CONFIG_DIR;
}

export function loadCliConfig(): CliConfig | null {
  if (!existsSync(CONFIG_FILE)) {
    return null;
  }

  try {
    const content = readFileSync(CONFIG_FILE, "utf-8");
    return configSchema.parse(JSON.parse(content));
  } catch {
    return null;
  }
}

export function saveCliConfig(config: CliConfig): void {
  mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 });
  writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), {
    mode: 0o600,
  });
}
