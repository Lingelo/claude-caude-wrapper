import { loadConfig } from "./config.js";
import { createServer } from "./server.js";
import { closeDb } from "./db/sqlite.js";

async function main() {
  const config = loadConfig();

  const app = await createServer(config);

  // Graceful shutdown
  const shutdown = async () => {
    app.log.info("Shutting down...");
    await app.close();
    closeDb();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  try {
    await app.listen({ port: config.port, host: config.host });
    app.log.info(
      `Claude Code Enterprise Proxy listening on ${config.host}:${config.port}`
    );
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

main();
