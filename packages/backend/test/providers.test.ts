import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { createAnthropicProvider } from "../src/providers/anthropic.ts";
import { createOpenAIProvider } from "../src/providers/openai.ts";
import { ProviderError, type StreamText } from "../src/providers/types.ts";

// Runs the real SDKs against a local stub. This checks our adapters, not that the vendors accept the request.
let server: Server | undefined;
let body: Record<string, unknown> = {};

afterEach(() => {
  server?.close();
  delete process.env.ANTHROPIC_BASE_URL;
  delete process.env.OPENAI_BASE_URL;
});

async function stub(events: object[]): Promise<string> {
  server = createServer((request, response) => {
    let raw = "";
    request.on("data", (chunk) => (raw += chunk));
    request.on("end", () => {
      body = JSON.parse(raw);
      response.setHeader("content-type", "text/event-stream");
      for (const event of events) {
        const { type } = event as { type: string };
        response.write(`event: ${type}\ndata: ${JSON.stringify(event)}\n\n`);
      }
      response.end();
    });
  });
  await new Promise<void>((resolve) => server?.listen(0, "127.0.0.1", resolve));
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}

const request = {
  model: "some-model",
  system: "be brief",
  messages: [{ role: "user" as const, content: "hi" }],
  signal: new AbortController().signal,
};

const collect = (stream: StreamText) => Array.fromAsync(stream(request));

const anthropicEvents = (stopReason: string) => [
  {
    type: "message_start",
    message: {
      id: "m", type: "message", role: "assistant", model: "some-model", content: [],
      stop_reason: null, stop_sequence: null, usage: { input_tokens: 1, output_tokens: 0 },
    },
  },
  { type: "content_block_start", index: 0, content_block: { type: "text", text: "" } },
  { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: "Hel" } },
  { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: "lo" } },
  { type: "content_block_stop", index: 0 },
  { type: "message_delta", delta: { stop_reason: stopReason, stop_sequence: null }, usage: { output_tokens: 2 } },
  { type: "message_stop" },
];

describe("Anthropic adapter", () => {
  it("streams text and sends the system prompt, history, and fallback opt-in", async () => {
    process.env.ANTHROPIC_BASE_URL = await stub(anthropicEvents("end_turn"));
    expect(await collect(createAnthropicProvider("test-key"))).toEqual(["Hel", "lo"]);
    expect(body).toMatchObject({
      model: "some-model",
      system: "be brief",
      messages: request.messages,
      fallbacks: "default",
    });
  });

  it.each([
    ["refusal", /declined/],
    ["max_tokens", /cut off/],
  ])("reports stop reason %s", async (stopReason, message) => {
    process.env.ANTHROPIC_BASE_URL = await stub(anthropicEvents(stopReason));
    const result = collect(createAnthropicProvider("test-key"));
    await expect(result).rejects.toBeInstanceOf(ProviderError);
    await expect(result).rejects.toThrow(message);
  });
});

describe("OpenAI adapter", () => {
  it("streams text and sends the system prompt and history", async () => {
    process.env.OPENAI_BASE_URL = await stub([
      { type: "response.output_text.delta", delta: "Hel" },
      { type: "response.output_text.delta", delta: "lo" },
      { type: "response.completed" },
    ]);
    expect(await collect(createOpenAIProvider("test-key"))).toEqual(["Hel", "lo"]);
    expect(body).toMatchObject({
      model: "some-model",
      instructions: "be brief",
      input: request.messages,
      stream: true,
    });
  });

  it.each([
    ["response.refusal.done", /declined/],
    ["response.incomplete", /cut off/],
  ])("reports %s", async (type, message) => {
    process.env.OPENAI_BASE_URL = await stub([{ type }]);
    await expect(collect(createOpenAIProvider("test-key"))).rejects.toThrow(message);
  });

  it("treats a failed response as an internal error", async () => {
    process.env.OPENAI_BASE_URL = await stub([{ type: "response.failed" }]);
    const result = collect(createOpenAIProvider("test-key"));
    await expect(result).rejects.toThrow(/stream failed/);
    await expect(result).rejects.not.toBeInstanceOf(ProviderError);
  });
});
