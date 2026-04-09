#!/usr/bin/env node

import { Command } from "commander";
import chalk from "chalk";
import { existsSync } from "node:fs";
import { appendFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { loadCliConfig, saveCliConfig, type CliConfig } from "../src/config.js";
import { getAccessToken } from "../src/auth/index.js";
import { spawnClaude } from "../src/spawn.js";
import { deleteTokens, loadTokens, isTokenExpired } from "../src/auth/token-store.js";
import { printBanner, logStep, logDetail, logSuccess, logError, logWarning } from "../src/ui.js";

const program = new Command();

program
  .name("claude-enterprise")
  .description("Enterprise Claude Code wrapper with Auth0 authentication")
  .version("0.1.0");

program
  .command("configure")
  .description("Configure the CLI with Auth0 and proxy settings")
  .requiredOption("--auth0-domain <domain>", "Auth0 domain (e.g., your-tenant.auth0.com)")
  .requiredOption("--auth0-client-id <id>", "Auth0 application client ID")
  .requiredOption("--auth0-audience <audience>", "Auth0 API audience identifier")
  .requiredOption("--proxy-url <url>", "Claude Code proxy URL")
  .action(async (options) => {
    printBanner();
    logStep("config", "Saving configuration...");

    const config: CliConfig = {
      auth0Domain: options.auth0Domain,
      auth0ClientId: options.auth0ClientId,
      auth0Audience: options.auth0Audience,
      proxyUrl: options.proxyUrl,
    };
    saveCliConfig(config);

    logDetail(`Auth0 Domain:    ${config.auth0Domain}`);
    logDetail(`Auth0 Client ID: ${config.auth0ClientId}`);
    logDetail(`Auth0 Audience:  ${config.auth0Audience}`);
    logDetail(`Proxy URL:       ${config.proxyUrl}`);
    logSuccess("Configuration saved to ~/.claude-enterprise/config.json");
    console.log();
    console.log(chalk.dim("  Next steps:"));
    console.log(chalk.dim("    1. Run ") + chalk.cyan("claude-enterprise login") + chalk.dim(" to authenticate"));
    console.log(chalk.dim("    2. Run ") + chalk.cyan("claude-enterprise") + chalk.dim(" to start Claude Code"));
    console.log();
  });

program
  .command("login")
  .description("Authenticate with Auth0 (device flow)")
  .action(async () => {
    printBanner();

    const config = loadCliConfig();
    if (!config) {
      logError("Not configured. Run: claude-enterprise configure --help");
      process.exit(1);
    }

    try {
      await getAccessToken(config);
    } catch (err) {
      logError(`Login failed: ${(err as Error).message}`);
      process.exit(1);
    }
  });

program
  .command("logout")
  .description("Clear cached authentication tokens")
  .action(() => {
    printBanner();
    deleteTokens();
    logSuccess("Logged out. Cached tokens have been cleared.");
    console.log();
  });

program
  .command("status")
  .description("Show current configuration and authentication status")
  .action(() => {
    printBanner();

    const config = loadCliConfig();
    if (!config) {
      logWarning("Not configured. Run: claude-enterprise configure --help");
      console.log();
      return;
    }

    logStep("config", "Configuration");
    logDetail(`Auth0 Domain:    ${config.auth0Domain}`);
    logDetail(`Auth0 Client ID: ${config.auth0ClientId}`);
    logDetail(`Auth0 Audience:  ${config.auth0Audience}`);
    logDetail(`Proxy URL:       ${config.proxyUrl}`);

    const tokens = loadTokens();
    if (tokens) {
      if (isTokenExpired(tokens)) {
        logWarning("Token expired (will refresh on next run)");
      } else {
        const expiresIn = Math.round((tokens.expires_at - Date.now() / 1000) / 60);
        logSuccess(`Token valid (expires in ${expiresIn} min)`);
      }
    } else {
      logWarning("Not authenticated. Run: claude-enterprise login");
    }
    console.log();
  });

program
  .command("setup-path")
  .description("Add claude-enterprise to your shell PATH (creates alias 'cc')")
  .option("--alias <name>", "Custom alias name", "cc")
  .action(async (options) => {
    printBanner();
    logStep("config", "Setting up shell alias...");

    const alias = options.alias;
    const binPath = process.argv[1];
    const shellLine = `\n# Claude Code Enterprise\nalias ${alias}="${binPath}"\n`;

    // Detect shell config file
    const shell = process.env.SHELL ?? "";
    let rcFile: string;
    if (shell.includes("zsh")) {
      rcFile = join(homedir(), ".zshrc");
    } else if (shell.includes("fish")) {
      // Fish uses a different syntax
      const fishConfig = join(homedir(), ".config", "fish", "config.fish");
      const fishLine = `\n# Claude Code Enterprise\nalias ${alias} "${binPath}"\n`;
      appendFileSync(fishConfig, fishLine);
      logSuccess(`Alias '${alias}' added to ${fishConfig}`);
      logDetail(`Run: source ${fishConfig}`);
      console.log();
      return;
    } else {
      rcFile = join(homedir(), ".bashrc");
    }

    // Check if alias already exists
    if (existsSync(rcFile)) {
      const content = readFileSync(rcFile, "utf-8");
      if (content.includes(`alias ${alias}=`)) {
        logWarning(`Alias '${alias}' already exists in ${rcFile}`);
        console.log();
        return;
      }
    }

    appendFileSync(rcFile, shellLine);
    logSuccess(`Alias '${alias}' added to ${rcFile}`);
    logDetail(`Run: ${chalk.cyan(`source ${rcFile}`)} or open a new terminal`);
    console.log();
    console.log(chalk.dim("  Usage:"));
    console.log(chalk.dim("    ") + chalk.cyan(alias) + chalk.dim("            # Start Claude Code"));
    console.log(chalk.dim("    ") + chalk.cyan(`${alias} -p "hello"`) + chalk.dim("  # Headless mode"));
    console.log(chalk.dim("    ") + chalk.cyan(`${alias} status`) + chalk.dim("     # Check status"));
    console.log();
  });

// Default command: forward to claude
program
  .command("run", { isDefault: true })
  .description("Run Claude Code through the enterprise proxy")
  .allowUnknownOption(true)
  .allowExcessArguments(true)
  .action(async (_, cmd) => {
    printBanner();

    const config = loadCliConfig();
    if (!config) {
      logError("Not configured.");
      console.log();
      console.log(chalk.dim("  Run the following to get started:"));
      console.log(
        chalk.cyan(
          "    claude-enterprise configure \\\n" +
          "      --auth0-domain your-tenant.auth0.com \\\n" +
          "      --auth0-client-id YOUR_CLIENT_ID \\\n" +
          "      --auth0-audience https://your-api-audience \\\n" +
          "      --proxy-url https://proxy.corp.example.com"
        )
      );
      console.log();
      process.exit(1);
    }

    try {
      logStep("config", "Loading configuration...");
      logDetail(`Proxy: ${config.proxyUrl}`);

      const accessToken = await getAccessToken(config);
      const claudeArgs = cmd.args;
      const exitCode = await spawnClaude(
        config.proxyUrl,
        accessToken,
        claudeArgs
      );
      process.exit(exitCode);
    } catch (err) {
      logError((err as Error).message);
      console.log();
      process.exit(1);
    }
  });

program.parse();
