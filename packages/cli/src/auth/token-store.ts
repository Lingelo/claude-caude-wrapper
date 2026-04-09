import { existsSync, readFileSync, writeFileSync, unlinkSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { getConfigDir } from "../config.js";

const TOKEN_FILE = join(getConfigDir(), "token.json");

export interface StoredTokens {
  access_token: string;
  refresh_token: string;
  id_token?: string;
  expires_at: number; // Unix timestamp in seconds
  obtained_at: number;
}

export function loadTokens(): StoredTokens | null {
  if (!existsSync(TOKEN_FILE)) {
    return null;
  }

  try {
    const content = readFileSync(TOKEN_FILE, "utf-8");
    return JSON.parse(content) as StoredTokens;
  } catch {
    return null;
  }
}

export function saveTokens(tokens: StoredTokens): void {
  mkdirSync(getConfigDir(), { recursive: true, mode: 0o700 });
  writeFileSync(TOKEN_FILE, JSON.stringify(tokens, null, 2), {
    mode: 0o600,
  });
}

export function deleteTokens(): void {
  if (existsSync(TOKEN_FILE)) {
    unlinkSync(TOKEN_FILE);
  }
}

export function isTokenExpired(tokens: StoredTokens): boolean {
  const now = Math.floor(Date.now() / 1000);
  // Consider expired if within 5 minutes of expiry
  return now >= tokens.expires_at - 300;
}
