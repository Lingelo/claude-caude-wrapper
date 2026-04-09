import type { CliConfig } from "../config.js";
import { saveTokens, type StoredTokens } from "./token-store.js";

interface DeviceCodeResponse {
  device_code: string;
  user_code: string;
  verification_uri: string;
  verification_uri_complete: string;
  interval: number;
  expires_in: number;
}

interface TokenResponse {
  access_token: string;
  refresh_token: string;
  id_token?: string;
  expires_in: number;
  token_type: string;
}

interface TokenErrorResponse {
  error: string;
  error_description?: string;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function deviceFlowLogin(
  config: CliConfig
): Promise<StoredTokens> {
  // Step 1: Request device code
  const codeResponse = await fetch(
    `https://${config.auth0Domain}/oauth/device/code`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: config.auth0ClientId,
        scope: "openid profile email offline_access",
        audience: config.auth0Audience,
      }),
    }
  );

  if (!codeResponse.ok) {
    const errorText = await codeResponse.text();
    throw new Error(`Failed to request device code: ${errorText}`);
  }

  const deviceCode = (await codeResponse.json()) as DeviceCodeResponse;

  // Step 2: Display instructions and open browser
  console.log();
  console.log("  To authenticate, please visit:");
  console.log(`  ${deviceCode.verification_uri_complete}`);
  console.log();
  console.log(`  Or open ${deviceCode.verification_uri} and enter code: ${deviceCode.user_code}`);
  console.log();
  console.log("  Waiting for authorization...");

  // Try to open browser
  try {
    const open = (await import("open")).default;
    await open(deviceCode.verification_uri_complete);
  } catch {
    // Browser open failed — user will manually navigate
  }

  // Step 3: Poll for token
  let interval = deviceCode.interval * 1000;
  const deadline = Date.now() + deviceCode.expires_in * 1000;

  while (Date.now() < deadline) {
    await sleep(interval);

    const tokenResponse = await fetch(
      `https://${config.auth0Domain}/oauth/token`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          grant_type: "urn:ietf:params:oauth:grant-type:device_code",
          device_code: deviceCode.device_code,
          client_id: config.auth0ClientId,
        }),
      }
    );

    if (tokenResponse.ok) {
      const data = (await tokenResponse.json()) as TokenResponse;
      const now = Math.floor(Date.now() / 1000);

      const tokens: StoredTokens = {
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        id_token: data.id_token,
        expires_at: now + data.expires_in,
        obtained_at: now,
      };

      saveTokens(tokens);
      console.log("  Authenticated successfully!");
      console.log();
      return tokens;
    }

    const error = (await tokenResponse.json()) as TokenErrorResponse;

    switch (error.error) {
      case "authorization_pending":
        // Continue polling
        break;
      case "slow_down":
        interval += 5000;
        break;
      case "expired_token":
        throw new Error(
          "Device code expired. Please try again."
        );
      case "access_denied":
        throw new Error(
          "Authorization was denied. Please contact your administrator."
        );
      default:
        throw new Error(
          `Authentication failed: ${error.error_description ?? error.error}`
        );
    }
  }

  throw new Error("Device code expired. Please try again.");
}
