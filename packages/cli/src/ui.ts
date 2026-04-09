import chalk from "chalk";

const BANNER = `
${chalk.cyan("   _____ _                 _        _____          _      ")}
${chalk.cyan("  / ____| |               | |      / ____|        | |     ")}
${chalk.cyan(" | |    | | __ _ _   _  __| | ___ | |     ___   __| | ___ ")}
${chalk.cyan(" | |    | |/ _\` | | | |/ _\` |/ _ \\| |    / _ \\ / _\` |/ _ \\")}
${chalk.cyan(" | |____| | (_| | |_| | (_| |  __/| |___| (_) | (_| |  __/")}
${chalk.cyan("  \\_____|_|\\__,_|\\__,_|\\__,_|\\___| \\_____\\___/ \\__,_|\\___|")}
${chalk.dim("  ───────────────────────────────────────────────────────")}
${chalk.bold.white("  Enterprise Edition")}${chalk.dim("  |  Auth0/Okta Authentication")}
`;

export function printBanner(): void {
  console.log(BANNER);
}

export function logStep(step: string, message: string): void {
  const icon = getStepIcon(step);
  console.log(`  ${icon} ${chalk.bold(message)}`);
}

export function logDetail(message: string): void {
  console.log(`     ${chalk.dim(message)}`);
}

export function logSuccess(message: string): void {
  console.log(`  ${chalk.green("✓")} ${chalk.green(message)}`);
}

export function logError(message: string): void {
  console.log(`  ${chalk.red("✗")} ${chalk.red(message)}`);
}

export function logWarning(message: string): void {
  console.log(`  ${chalk.yellow("!")} ${chalk.yellow(message)}`);
}

function getStepIcon(step: string): string {
  const icons: Record<string, string> = {
    config: chalk.blue("⚙"),
    auth: chalk.yellow("🔐"),
    token: chalk.cyan("🎟"),
    refresh: chalk.cyan("↻"),
    proxy: chalk.magenta("⇄"),
    launch: chalk.green("▶"),
    done: chalk.green("✓"),
  };
  return icons[step] ?? chalk.white("•");
}
