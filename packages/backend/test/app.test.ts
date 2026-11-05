import { Writable } from "node:stream";
import { describe, expect, it } from "vitest";
import type { AddressInfo } from "node:net";
import { AGENTS } from "../src/agents.ts";
import { buildApp } from "../src/app.ts";
import { devAuthenticate, type User } from "../src/auth.ts";
import { loadConfig } from "../src/config.ts";
import type { Model } from "../src/models.ts";
import { streamMock } from "../src/providers/mock.ts";
import { ProviderError } from "../src/providers/types.ts";

const mock: Model = { id: "mock", name: "Mock", stream: streamMock };
const employee: User = { email: "a@edvenswa.local", roles: [] };

function appFor(user: User | null = employee, models: Model[] = [mock], logger?: object) {
  return buildApp({ authenticate: async () => user, models, ...(logger ? { logger } : {}) });
}

const chat = (app: ReturnType<typeof appFor>, body: object) =>
  app.inject({ method: "POST", url: "/v1/chat", payload: { agent: "general", model: "mock", ...body } });

const events = (payload: string) =>
  payload
    .split("\n\n")
    .filter(Boolean)
    .map((frame) => JSON.parse(frame.replace("data: ", "")));

describe("authentication", () => {
  it.each(["/v1/me", "/v1/conversations"])("rejects unauthenticated GET %s", async (url) => {
    const response = await appFor(null).inject({ url });
    expect(response.statusCode).toBe(401);
  });

  it("rejects unauthenticated chat before running the model", async () => {
    const response = await chat(appFor(null), { message: "hi" });
    expect(response.statusCode).toBe(401);
  });

  it("leaves /health public", async () => {
    expect((await appFor(null).inject({ url: "/health" })).statusCode).toBe(200);
  });
});

describe("authorization", () => {
  it("hides agents the user can't use", async () => {
    const me = (await appFor().inject({ url: "/v1/me" })).json();
    expect(me.agents.map((agent: { id: string }) => agent.id)).toEqual(["general"]);
  });

  it.each(["emportal", "coding"])("returns 403 when calling %s directly without the role", async (agent) => {
    expect((await chat(appFor(), { agent, message: "hi" })).statusCode).toBe(403);
  });

  it("returns 409, not a reply, for permitted agents that aren't built", async () => {
    const manager = appFor({ email: "m@edvenswa.local", roles: ["Manager"] });
    expect((await chat(manager, { agent: "emportal", message: "hi" })).statusCode).toBe(409);
  });

  it("rejects models outside the allowlist", async () => {
    expect((await chat(appFor(), { model: "gpt-unknown", message: "hi" })).statusCode).toBe(400);
  });

  it.each([{ message: "" }, { message: "hi", agent: "other" }, { message: "hi", extra: 1, model: 3 }])(
    "rejects invalid body %j",
    async (body) => {
      expect((await chat(appFor(), body)).statusCode).toBe(400);
    },
  );
});

describe("conversations", () => {
  it("streams a reply and keeps context across turns", async () => {
    const app = appFor();
    const first = events((await chat(app, { message: "one" })).payload);
    expect(first.at(0).type).toBe("start");
    expect(first.at(-1).type).toBe("done");

    const conversationId = first[0].conversationId;
    const second = events((await chat(app, { message: "two", conversationId })).payload);
    const reply = second.filter((event) => event.type === "text").map((event) => event.text).join("");
    expect(reply).toBe("[mock reply, turn 2] You said: two");

    const detail = (await app.inject({ url: `/v1/conversations/${conversationId}` })).json();
    expect(detail.messages.map((message: { role: string }) => message.role)).toEqual([
      "user", "assistant", "user", "assistant",
    ]);
  });

  it("doesn't let one user read or continue another user's conversation", async () => {
    let user = employee;
    const app = buildApp({ authenticate: async () => user, models: [mock] });
    const { conversationId } = events((await chat(app, { message: "secret" })).payload)[0];

    user = { email: "b@edvenswa.local", roles: [] };
    expect((await app.inject({ url: `/v1/conversations/${conversationId}` })).statusCode).toBe(404);
    expect((await chat(app, { message: "hi", conversationId })).statusCode).toBe(404);
    expect((await app.inject({ url: "/v1/conversations" })).json()).toEqual([]);
  });

  it("doesn't let a conversation move to another agent", async () => {
    const app = buildApp({
      authenticate: async () => ({ email: "e@edvenswa.local", roles: ["Engineer"] }),
      models: [mock],
      agents: { ...AGENTS, coding: { ...AGENTS.coding, available: true } },
    });
    const { conversationId } = events((await chat(app, { message: "hi" })).payload)[0];
    const moved = await chat(app, { agent: "coding", message: "hi", conversationId });
    expect(moved.statusCode).toBe(409);
    expect(moved.json().error).toContain("different agent");
  });

  it("stops the model and stores nothing when the client disconnects", async () => {
    let aborted = false;
    const slow: Model = {
      id: "mock",
      name: "Mock",
      stream: async function* ({ signal }) {
        yield "partial";
        await new Promise((resolve) => signal.addEventListener("abort", resolve));
        aborted = true;
        throw new Error("aborted");
      },
    };
    const app = appFor(employee, [slow]);
    await app.listen({ host: "127.0.0.1", port: 0 });
    const url = `http://127.0.0.1:${(app.server.address() as AddressInfo).port}`;
    const client = new AbortController();
    const response = await fetch(`${url}/v1/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ agent: "general", model: "mock", message: "hi" }),
      signal: client.signal,
    });
    await response.body?.getReader().read();
    client.abort();
    await expect.poll(() => aborted).toBe(true);
    expect((await app.inject({ url: "/v1/conversations" })).json()).toEqual([]);
    await app.close();
  });
});

describe("provider failures", () => {
  const failing = (error: Error): Model => ({
    id: "mock",
    name: "Mock",
    stream: async function* () {
      yield "partial";
      throw error;
    },
  });

  it("hides internal errors, shows ProviderError messages, and stores neither turn", async () => {
    const hidden = appFor(employee, [failing(new Error("sk-secret-detail"))]);
    const response = await chat(hidden, { message: "hi" });
    expect(response.payload).not.toContain("sk-secret-detail");
    expect(events(response.payload).at(-1).type).toBe("error");
    expect((await hidden.inject({ url: "/v1/conversations" })).json()).toEqual([]);

    const shown = appFor(employee, [failing(new ProviderError("The model declined this request."))]);
    expect(events((await chat(shown, { message: "hi" })).payload).at(-1).message).toBe(
      "The model declined this request.",
    );
  });

  it("keeps prompts and replies out of the logs", async () => {
    let logs = "";
    const stream = new Writable({
      write(chunk, _encoding, done) {
        logs += chunk;
        done();
      },
    });
    const app = appFor(employee, [mock], { level: "info", stream });
    await chat(app, { message: "confidential-salary-question" });
    expect(logs).toContain("chat completed");
    expect(logs).not.toContain("confidential-salary-question");
  });
});

describe("config", () => {
  it("refuses to start outside dev mode, since real auth doesn't exist yet", () => {
    expect(() => loadConfig({})).toThrow(/Real authentication/);
    expect(() => loadConfig({ EDVEN_ENV: "production" })).toThrow(/Real authentication/);
  });

  it("refuses to expose dev mode beyond localhost", () => {
    expect(() => loadConfig({ EDVEN_ENV: "dev", HOST: "0.0.0.0" })).toThrow(/localhost/);
  });

  it("parses dev identity roles", async () => {
    const config = loadConfig({ EDVEN_ENV: "dev", EDVEN_DEV_ROLES: "Manager, Engineer" });
    const user = await devAuthenticate(config.devIdentity)({} as never);
    expect(user?.roles).toEqual(["Manager", "Engineer"]);
  });
});
