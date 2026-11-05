import type {
  ApiError,
  ChatEvent,
  ChatRequest,
  ConversationDetail,
  ConversationSummary,
  MeResponse,
} from "@edven-ai/protocol";

export class BackendError extends Error {}

/** Conversation content goes over this connection, so only localhost may use plain HTTP. */
export function assertSafeUrl(baseUrl: string): void {
  let url: URL;
  try {
    url = new URL(baseUrl);
  } catch {
    throw new BackendError(`Invalid backend URL: ${baseUrl}`);
  }
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (url.protocol !== "https:" && !(url.protocol === "http:" && local)) {
    throw new BackendError(`The backend URL must use https:// unless it is localhost: ${baseUrl}`);
  }
}

export class ApiClient {
  #baseUrl: string;

  constructor(baseUrl: string) {
    assertSafeUrl(baseUrl);
    this.#baseUrl = baseUrl.replace(/\/+$/, "");
  }

  async #request(path: string, init?: RequestInit): Promise<Response> {
    let response: Response;
    try {
      response = await fetch(`${this.#baseUrl}${path}`, init);
    } catch (error) {
      if ((error as Error).name === "AbortError") throw error;
      throw new BackendError(`Can't reach the backend at ${this.#baseUrl}. Is it running?`);
    }
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as ApiError | null;
      throw new BackendError(body?.error ?? `Backend error (HTTP ${response.status}).`);
    }
    return response;
  }

  async #json<T>(path: string): Promise<T> {
    return (await this.#request(path)).json() as Promise<T>;
  }

  me(): Promise<MeResponse> {
    return this.#json("/v1/me");
  }

  conversations(): Promise<ConversationSummary[]> {
    return this.#json("/v1/conversations");
  }

  conversation(id: string): Promise<ConversationDetail> {
    return this.#json(`/v1/conversations/${encodeURIComponent(id)}`);
  }

  async *chat(request: ChatRequest, signal: AbortSignal): AsyncGenerator<ChatEvent> {
    const response = await this.#request("/v1/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(request),
      signal,
    });
    if (!response.body) throw new BackendError("The backend sent an empty response.");
    let finished = false;
    try {
      for await (const event of parseEvents(response.body)) {
        finished ||= event.type === "done" || event.type === "error";
        yield event;
      }
    } catch (error) {
      if ((error as Error).name === "AbortError") throw error;
    }
    if (!finished) {
      if (signal.aborted) throw new DOMException("Cancelled", "AbortError");
      throw new BackendError("Lost the connection to the backend before the reply finished.");
    }
  }
}

/** Reads `data: <json>` frames. Our backend is the only sender, so this is all of SSE we need. */
export async function* parseEvents(body: ReadableStream<Uint8Array>): AsyncGenerator<ChatEvent> {
  let buffer = "";
  for await (const chunk of body.pipeThrough(new TextDecoderStream())) {
    buffer += chunk;
    let end: number;
    while ((end = buffer.indexOf("\n\n")) !== -1) {
      const frame = buffer.slice(0, end);
      buffer = buffer.slice(end + 2);
      if (frame.startsWith("data: ")) yield JSON.parse(frame.slice(6)) as ChatEvent;
    }
  }
}
