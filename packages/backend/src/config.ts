import { isIP } from "node:net";

export interface Config {
  host: string;
  port: number;
  logLevel: string;
  devIdentity: { email: string; roles: string[] };
  anthropicApiKey?: string;
  openaiApiKey?: string;
  mockModel: boolean;
}

function isLoopback(host: string): boolean {
  return host === "localhost" || host === "::1" || (isIP(host) === 4 && host.startsWith("127."));
}

/** Fails closed: the fake identity can only ever run in explicit dev mode on loopback. */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  if (env.EDVEN_ENV !== "dev") {
    throw new Error(
      "Real authentication is not implemented yet. Set EDVEN_ENV=dev to run locally with the fake identity.",
    );
  }
  const host = env.HOST || "127.0.0.1";
  if (!isLoopback(host)) {
    throw new Error(`EDVEN_ENV=dev must bind to localhost, not ${host}: dev mode has no real authentication.`);
  }
  const port = Number(env.PORT || 8787);
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new Error(`Invalid PORT: ${env.PORT}`);
  }
  return {
    host,
    port,
    logLevel: env.LOG_LEVEL || "info",
    devIdentity: {
      email: env.EDVEN_DEV_EMAIL || "dev@edvenswa.local",
      roles: (env.EDVEN_DEV_ROLES ?? "Engineer,Manager")
        .split(",")
        .map((role) => role.trim())
        .filter(Boolean),
    },
    anthropicApiKey: env.ANTHROPIC_API_KEY || undefined,
    openaiApiKey: env.OPENAI_API_KEY || undefined,
    mockModel: true,
  };
}
