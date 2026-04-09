import type { CliConfig } from "../config.js";
import { saveTokens, deleteTokens, type StoredTokens } from "./token-store.js";

export async function refreshAccessToken(
  config: CliConfig,
  tokens: StoredTokens
): Promise<StoredTokens | null> {
  try {
    const response = await fetch(
      `https://${config.auth0Domain}/oauth/token`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          grant_type: "refresh_token",
          client_id: config.auth0ClientId,
          refresh_token: tokens.refresh_token,
        }),
      }
    );

    if (!response.ok) {
      // Refresh token revoked or expired — need full re-auth
      deleteTokens();
      return null;
    }

    const data = (await response.json()) as {
      access_token: string;
      refresh_token?: string;
      id_token?: string;
      expires_in: number;
    };

    const now = Math.floor(Date.now() / 1000);
    const newTokens: StoredTokens = {
      access_token: data.access_token,
      // Auth0 with refresh token rotation returns a new refresh token
      refresh_token: data.refresh_token ?? tokens.refresh_token,
      id_token: data.id_token ?? tokens.id_token,
      expires_at: now + data.expires_in,
      obtained_at: now,
    };

    saveTokens(newTokens);
    return newTokens;
  } catch {
    deleteTokens();
    return null;
  }
}
