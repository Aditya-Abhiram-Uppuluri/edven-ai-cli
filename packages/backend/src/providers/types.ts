import type { ChatMessage } from "@edven-ai/protocol";

export interface StreamRequest {
  model: string;
  system: string;
  messages: ChatMessage[];
  signal: AbortSignal;
}

/** Yields response text as it arrives. Throws ProviderError for failures the user should read. */
export type StreamText = (request: StreamRequest) => AsyncIterable<string>;

/** Its message is safe to show to users. Any other error is logged and reported generically. */
export class ProviderError extends Error {}
