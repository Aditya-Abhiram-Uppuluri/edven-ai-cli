import Anthropic from "@anthropic-ai/sdk";
import { ProviderError, type StreamText } from "./types.ts";

export function createAnthropicProvider(apiKey: string): StreamText {
  const client = new Anthropic({ apiKey });

  return async function* ({ model, system, messages, signal }) {
    const stream = client.beta.messages.stream(
      {
        model,
        max_tokens: 64000,
        system,
        messages,
        output_config: { effort: "medium" },
        // If Claude's safety classifiers decline, Anthropic re-runs the request on its recommended model.
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
      },
      { signal },
    );

    for await (const event of stream) {
      if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
        yield event.delta.text;
      } else if (event.type === "message_delta") {
        if (event.delta.stop_reason === "refusal") {
          throw new ProviderError("The model declined this request.");
        }
        if (event.delta.stop_reason === "max_tokens") {
          throw new ProviderError("The response hit the length limit and was cut off.");
        }
      }
    }
  };
}
