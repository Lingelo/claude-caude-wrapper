import type { CliConfig } from "../config.js";
import { loadTokens, isTokenExpired, type StoredTokens } from "./token-store.js";
import { refreshAccessToken } from "./token-refresh.js";
import { deviceFlowLogin } from "./device-flow.js";

/**
 * Get a valid access token, refreshing or re-authenticating as needed.
 */
export async function getAccessToken(config: CliConfig): Promise<string> {
  // Check for cached token
  const tokens = loadTokens();

  if (tokens && !isTokenExpired(tokens)) {
    return tokens.access_token;
  }

  // Try refresh if we have a refresh token
  if (tokens?.refresh_token) {
    const refreshed = await refreshAccessToken(config, tokens);
    if (refreshed) {
      return refreshed.access_token;
    }
  }

  // Full device flow login
  const newTokens = await deviceFlowLogin(config);
  return newTokens.access_token;
}
