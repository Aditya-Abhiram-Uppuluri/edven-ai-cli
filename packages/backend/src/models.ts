import type { ModelInfo } from "@edven-ai/protocol";
import type { Config } from "./config.ts";
import { createAnthropicProvider } from "./providers/anthropic.ts";
import { streamMock } from "./providers/mock.ts";
import { createOpenAIProvider } from "./providers/openai.ts";
import type { StreamText } from "./providers/types.ts";

export interface Model extends ModelInfo {
  stream: StreamText;
}

/** The server-side allowlist. The first entry is the default. Clients can't request anything else. */
export function loadModels(config: Config): Model[] {
  const models: Model[] = [];
  if (config.anthropicApiKey) {
    const stream = createAnthropicProvider(config.anthropicApiKey);
    models.push(
      { id: "claude-sonnet-5-5", name: "Claude Sonnet 5.5", stream },
      { id: "claude-opus-5-5", name: "Claude Opus 5.5", stream },
    );
  }
  if (config.openaiApiKey) {
    const stream = createOpenAIProvider(config.openaiApiKey);
    models.push({ id: "gpt-5.3-chat-latest", name: "GPT-5.3", stream });
  }
  if (config.mockModel) {
    models.push({ id: "mock", name: "Mock (dev only)", stream: streamMock });
  }
  return models;
}
