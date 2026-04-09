import { z } from "zod";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import "dotenv/config";
import type { RoleKeysMapping } from "./types.js";

const configSchema = z.object({
  auth0Domain: z.string().min(1),
  auth0Audience: z.string().min(1),
  port: z.coerce.number().int().positive().default(8080),
  host: z.string().default("0.0.0.0"),
  databasePath: z.string().default("./data/usage.db"),
  logLevel: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace"])
    .default("info"),
  rateLimitRpm: z.coerce.number().int().positive().default(60),
  anthropicUpstreamUrl: z
    .string()
    .url()
    .default("https://api.anthropic.com"),
  roleKeysConfig: z.string().min(1),
});

export type Config = z.infer<typeof configSchema> & {
  roleKeys: RoleKeysMapping;
};

function loadRoleKeys(configValue: string): RoleKeysMapping {
  // Try as file path first
  const resolved = resolve(configValue);
  if (existsSync(resolved)) {
    const content = readFileSync(resolved, "utf-8");
    return JSON.parse(content) as RoleKeysMapping;
  }

  // Try as inline JSON
  try {
    return JSON.parse(configValue) as RoleKeysMapping;
  } catch {
    throw new Error(
      `ROLE_KEYS_CONFIG must be a path to a JSON file or valid inline JSON. Got: ${configValue}`
    );
  }
}

export function loadConfig(): Config {
  const parsed = configSchema.parse({
    auth0Domain: process.env.AUTH0_DOMAIN,
    auth0Audience: process.env.AUTH0_AUDIENCE,
    port: process.env.PORT,
    host: process.env.HOST,
    databasePath: process.env.DATABASE_PATH,
    logLevel: process.env.LOG_LEVEL,
    rateLimitRpm: process.env.RATE_LIMIT_RPM,
    anthropicUpstreamUrl: process.env.ANTHROPIC_UPSTREAM_URL,
    roleKeysConfig: process.env.ROLE_KEYS_CONFIG,
  });

  const roleKeys = loadRoleKeys(parsed.roleKeysConfig);

  if (!roleKeys.role_keys || Object.keys(roleKeys.role_keys).length === 0) {
    throw new Error("ROLE_KEYS_CONFIG must contain at least one role mapping");
  }

  if (!roleKeys.role_keys["default"]) {
    throw new Error(
      'ROLE_KEYS_CONFIG must contain a "default" role as fallback'
    );
  }

  return { ...parsed, roleKeys };
}
