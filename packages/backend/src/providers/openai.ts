import OpenAI from "openai";
import { ProviderError, type StreamText } from "./types.ts";

export function createOpenAIProvider(apiKey: string): StreamText {
  const client = new OpenAI({ apiKey });

  return async function* ({ model, system, messages, signal }) {
    const stream = await client.responses.create(
      { model, instructions: system, input: messages, stream: true },
      { signal },
    );

    for await (const event of stream) {
      if (event.type === "response.output_text.delta") {
        yield event.delta;
      } else if (event.type === "response.refusal.done") {
        throw new ProviderError("The model declined this request.");
      } else if (event.type === "response.incomplete") {
        throw new ProviderError("The response was cut off before it finished.");
      } else if (event.type === "response.failed" || event.type === "error") {
        throw new Error(`OpenAI stream failed: ${event.type}`);
      }
    }
  };
}
