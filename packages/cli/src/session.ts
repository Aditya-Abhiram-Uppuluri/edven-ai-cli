import { styleText } from "node:util";
import type { AgentInfo, MeResponse } from "@edven-ai/protocol";
import { type ApiClient, BackendError } from "./api.ts";

export interface Io {
  write(text: string): void;
  /** Resolves to undefined at end of input. */
  readLine(prompt: string): Promise<string | undefined>;
  /** Called with a function to run on Ctrl-C while a reply streams. */
  onInterrupt(handler: (() => void) | null): void;
}

export const dim = (text: string) => styleText("dim", text);
export const bold = (text: string) => styleText("bold", text);
export const red = (text: string) => styleText("red", text);

export class Session {
  readonly api: ApiClient;
  readonly io: Io;
  readonly me: MeResponse;
  agent: AgentInfo;
  model: string | null;
  conversationId: string | undefined;
  running = true;

  constructor(api: ApiClient, io: Io, me: MeResponse) {
    this.api = api;
    this.io = io;
    this.me = me;
    const general = me.agents.find(({ id }) => id === "general");
    if (!general) throw new Error("The backend didn't offer the General agent.");
    this.agent = general;
    this.model = me.defaultModel;
  }

  print(line = ""): void {
    this.io.write(`${line}\n`);
  }

  modelName(): string {
    return this.me.models.find(({ id }) => id === this.model)?.name ?? "none available";
  }

  async send(message: string): Promise<void> {
    if (!this.model) {
      this.print(red("No models are available. Set a provider API key on the backend."));
      return;
    }
    const abort = new AbortController();
    this.io.onInterrupt(() => abort.abort());
    let startedId: string | undefined;
    let wroteText = false;
    try {
      const events = this.api.chat(
        {
          agent: this.agent.id,
          model: this.model,
          message,
          ...(this.conversationId ? { conversationId: this.conversationId } : {}),
        },
        abort.signal,
      );
      for await (const event of events) {
        if (event.type === "start") {
          startedId = event.conversationId;
        } else if (event.type === "text") {
          this.io.write(event.text);
          wroteText = true;
        } else if (event.type === "error") {
          this.print(`${wroteText ? "\n" : ""}${red(event.message)}`);
        } else {
          // The backend saves a turn only when it completes, so only now does the id exist there.
          this.conversationId = startedId;
          this.print();
        }
      }
    } catch (error) {
      if ((error as Error).name === "AbortError") {
        this.print(dim("\n(cancelled)"));
      } else {
        if (wroteText && error instanceof BackendError) this.print();
        throw error;
      }
    } finally {
      this.io.onInterrupt(null);
    }
  }
}
