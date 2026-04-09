#!/usr/bin/env node

import { Command } from "commander";
import chalk from "chalk";
import { loadCliConfig, saveCliConfig, type CliConfig } from "../src/config.js";
import { getAccessToken } from "../src/auth/index.js";
import { spawnClaude } from "../src/spawn.js";
import { deleteTokens } from "../src/auth/token-store.js";

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
    const config: CliConfig = {
      auth0Domain: options.auth0Domain,
      auth0ClientId: options.auth0ClientId,
      auth0Audience: options.auth0Audience,
      proxyUrl: options.proxyUrl,
    };
    saveCliConfig(config);
    console.log(chalk.green("Configuration saved successfully."));
  });

program
  .command("login")
  .description("Authenticate with Auth0 (device flow)")
  .action(async () => {
    const config = loadCliConfig();
    if (!config) {
      console.error(
        chalk.red("Not configured. Run: claude-enterprise configure --help")
      );
      process.exit(1);
    }

    try {
      await getAccessToken(config);
    } catch (err) {
      console.error(chalk.red(`Login failed: ${(err as Error).message}`));
      process.exit(1);
    }
  });

program
  .command("logout")
  .description("Clear cached authentication tokens")
  .action(() => {
    deleteTokens();
    console.log(chalk.green("Logged out successfully."));
  });

program
  .command("status")
  .description("Show current configuration and authentication status")
  .action(() => {
    const config = loadCliConfig();
    if (!config) {
      console.log(chalk.yellow("Not configured."));
      return;
    }

    console.log(chalk.bold("Configuration:"));
    console.log(`  Auth0 Domain:    ${config.auth0Domain}`);
    console.log(`  Auth0 Client ID: ${config.auth0ClientId}`);
    console.log(`  Auth0 Audience:  ${config.auth0Audience}`);
    console.log(`  Proxy URL:       ${config.proxyUrl}`);
  });

// Default command: forward to claude
program
  .command("run", { isDefault: true })
  .description("Run Claude Code through the enterprise proxy")
  .allowUnknownOption(true)
  .allowExcessArguments(true)
  .action(async (_, cmd) => {
    const config = loadCliConfig();
    if (!config) {
      console.error(
        chalk.red(
          "Not configured. Run: claude-enterprise configure --help"
        )
      );
      process.exit(1);
    }

    try {
      const accessToken = await getAccessToken(config);
      const claudeArgs = cmd.args;
      const exitCode = await spawnClaude(
        config.proxyUrl,
        accessToken,
        claudeArgs
      );
      process.exit(exitCode);
    } catch (err) {
      console.error(chalk.red(`Error: ${(err as Error).message}`));
      process.exit(1);
    }
  });

program.parse();
