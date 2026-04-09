import type { CliConfig } from "../config.js";
import { loadTokens, isTokenExpired } from "./token-store.js";
import { refreshAccessToken } from "./token-refresh.js";
import { deviceFlowLogin } from "./device-flow.js";
import { logStep, logDetail, logSuccess } from "../ui.js";

/**
 * Get a valid access token, refreshing or re-authenticating as needed.
 * Logs each step to the user.
 */
export async function getAccessToken(config: CliConfig): Promise<string> {
  logStep("auth", "Checking authentication...");

  // Check for cached token
  const tokens = loadTokens();

  if (tokens && !isTokenExpired(tokens)) {
    const expiresIn = Math.round((tokens.expires_at - Date.now() / 1000) / 60);
    logSuccess(`Token valid (expires in ${expiresIn} min)`);
    return tokens.access_token;
  }

  // Try refresh if we have a refresh token
  if (tokens?.refresh_token) {
    logStep("refresh", "Token expired, refreshing...");
    const refreshed = await refreshAccessToken(config, tokens);
    if (refreshed) {
      logSuccess("Token refreshed successfully");
      return refreshed.access_token;
    }
    logDetail("Refresh failed, starting new login...");
  }

  // Full device flow login
  logStep("auth", "New authentication required (Auth0 Device Flow)");
  const newTokens = await deviceFlowLogin(config);
  logSuccess("Authenticated successfully");
  return newTokens.access_token;
}
