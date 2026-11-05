import { buildApp } from "./app.ts";
import { devAuthenticate } from "./auth.ts";
import { loadConfig } from "./config.ts";
import { loadModels } from "./models.ts";

try {
  const config = loadConfig();
  const app = buildApp({
    authenticate: devAuthenticate(config.devIdentity),
    models: loadModels(config),
    logger: { level: config.logLevel },
  });
  app.log.warn("Running in dev mode with a fake identity. Do not expose this server.");
  await app.listen({ host: config.host, port: config.port });
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
