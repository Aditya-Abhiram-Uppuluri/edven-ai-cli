import type { FastifyRequest } from "fastify";
import type { Config } from "./config.ts";

export interface User {
  email: string;
  roles: string[];
}

export type Authenticate = (request: FastifyRequest) => Promise<User | null>;

/**
 * Runs before every /v1 route. Returns null to reject with a 401.
 * Microsoft Entra replaces this function: validate the bearer token, return the
 * user and App Roles from its claims. Nothing downstream needs to change.
 */
export function devAuthenticate(identity: Config["devIdentity"]): Authenticate {
  return async () => identity;
}
