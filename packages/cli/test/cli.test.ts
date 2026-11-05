import { spawn } from "node:child_process";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../../backend/src/app.ts";
import type { User } from "../../backend/src/auth.ts";
import { streamMock } from "../../backend/src/providers/mock.ts";
import { ProviderError } from "../../backend/src/providers/types.ts";
import { assertSafeUrl, parseEvents } from "../src/api.ts";

const MAIN = fileURLToPath(new URL("../src/main.ts", import.meta.url));

/** Drives the real CLI process: one line of stdin at a time, end to end against a real backend. */
function runCli(baseUrl: string, input: string[], args: string[] = []) {
  return new Promise<{ code: number | null; output: string }>((resolve) => {
    const child = spawn(process.execPath, [MAIN, ...args], {
      env: { ...process.env, EDVEN_API_URL: baseUrl, NO_COLOR: "1" },
    });
    let output = "";
    child.stdout.on("data", (chunk) => (output += chunk));
    child.stderr.on("data", (chunk) => (output += chunk));
    child.stdin.end(input.map((line) => `${line}\n`).join(""));
    child.on("close", (code) => resolve({ code, output }));
  });
}

describe("edven-ai against a real backend", () => {
  const user: User = { email: "dev@edvenswa.local", roles: ["Engineer"] };
  const app = buildApp({
    authenticate: async () => user,
    models: [
      { id: "mock", name: "Mock", stream: streamMock },
      { id: "mock-2", name: "Second", stream: streamMock },
      {
        id: "fails",
        name: "Fails",
        stream: async function* () {
          yield "partial";
          throw new ProviderError("The model declined this request.");
        },
      },
    ],
  });
  let url = "";

  beforeAll(async () => {
    await app.listen({ host: "127.0.0.1", port: 0 });
    url = `http://127.0.0.1:${(app.server.address() as AddressInfo).port}`;
  });
  afterAll(() => app.close());

  it("shows who is signed in, chats with context, and exits", async () => {
    const { code, output } = await runCli(url, ["hello", "again", "/exit"]);
    expect(code).toBe(0);
    expect(output).toContain("Authenticated as: dev@edvenswa.local");
    expect(output).toContain("Active Agent: General");
    expect(output).toContain("[mock reply, turn 1] You said: hello");
    expect(output).toContain("[mock reply, turn 2] You said: again");
  });

  it("exits cleanly at end of input", async () => {
    expect((await runCli(url, ["hello"])).code).toBe(0);
  });

  it("starts over with /new", async () => {
    const { output } = await runCli(url, ["one", "/new", "two", "/exit"]);
    expect(output).toContain("[mock reply, turn 1] You said: two");
  });

  it("switches models by menu and by name", async () => {
    const menu = await runCli(url, ["/model", "2", "/exit"]);
    expect(menu.output).toContain("Active model: Second");
    const named = await runCli(url, ["/model mock-2", "/exit"]);
    expect(named.output).toContain("Active model: Second");
  });

  it("only offers permitted agents and doesn't switch to unbuilt ones", async () => {
    const { output } = await runCli(url, ["/agent", "coding", "/tools", "/exit"]);
    expect(output).toContain("Coding");
    expect(output).not.toContain("EmPortal");
    expect(output).toContain("The Coding agent isn't available yet.");
    expect(output).toContain("The General agent has no tools yet.");
  });

  it("lists and reopens conversations", async () => {
    const { output } = await runCli(url, ["remember this", "/history", "/history 1", "next", "/exit"]);
    expect(output).toContain("1. remember this");
    expect(output).toContain("> remember this");
    expect(output).toContain("You said: next");
  });

  it("handles unknown commands and every README command", async () => {
    const { code, output } = await runCli(url, ["/nope", "/help", "/login", "/logout", "/exit"]);
    expect(code).toBe(0);
    expect(output).toContain("Unknown command: /nope");
    for (const command of ["login", "logout", "agent", "model", "new", "history", "tools", "help", "exit"]) {
      expect(output).toContain(`/${command}`);
    }
    expect(output).toContain("Microsoft sign-in isn't connected yet");
  });

  it("recovers when the first message of a conversation fails", async () => {
    const { code, output } = await runCli(url, ["/model fails", "hi", "/model mock", "again", "/exit"]);
    expect(code).toBe(0);
    expect(output).toContain("The model declined this request.");
    expect(output).toContain("[mock reply, turn 1] You said: again");
  });

  it("explains a backend that dies mid-reply", async () => {
    const server = createServer((request, response) => {
      if (request.url === "/v1/me") {
        response.setHeader("content-type", "application/json");
        response.end(JSON.stringify({
          email: "x", roles: [], defaultModel: "m", models: [{ id: "m", name: "M" }],
          agents: [{ id: "general", name: "General", description: "", available: true, tools: [] }],
        }));
        return;
      }
      response.write('data: {"type":"text","text":"partial"}\n\n', () => response.destroy());
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const { code, output } = await runCli(
      `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
      ["hi", "/exit"],
    );
    server.close();
    expect(code).toBe(0);
    expect(output).toContain("Lost the connection");
  });

  it("explains an unreachable backend", async () => {
    const { code, output } = await runCli("http://127.0.0.1:9", []);
    expect(code).toBe(1);
    expect(output).toContain("Can't reach the backend");
  });

  it("prints its version", async () => {
    expect((await runCli(url, [], ["--version"])).output.trim()).toBe("0.1.0");
  });
});

describe("assertSafeUrl", () => {
  it.each(["https://edven.example", "http://localhost:8787", "http://127.0.0.1:8787"])("allows %s", (url) => {
    expect(() => assertSafeUrl(url)).not.toThrow();
  });

  it.each(["http://edven.example", "ftp://localhost", "not a url"])("refuses %s", (url) => {
    expect(() => assertSafeUrl(url)).toThrow();
  });
});

describe("parseEvents", () => {
  it("reassembles frames split across chunks, including multi-byte text", async () => {
    const bytes = new TextEncoder().encode('data: {"type":"text","text":"héllo"}\n\ndata: {"type":"done"}\n\n');
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        for (const byte of bytes) controller.enqueue(new Uint8Array([byte]));
        controller.close();
      },
    });
    const events = await Array.fromAsync(parseEvents(body));
    expect(events).toEqual([{ type: "text", text: "héllo" }, { type: "done" }]);
  });
});
