import { createInterface } from "node:readline";
import { ApiClient } from "./api.ts";
import { handleLine } from "./commands.ts";
import { bold, dim, type Io, Session } from "./session.ts";

export async function runRepl(baseUrl: string): Promise<void> {
  const api = new ApiClient(baseUrl);
  const me = await api.me();

  const terminal = createInterface({ input: process.stdin, output: process.stdout });
  const lines = terminal[Symbol.asyncIterator]();
  let closed = false;
  terminal.on("close", () => {
    closed = true;
  });
  let interrupt: (() => void) | null = null;
  // Ctrl-C cancels a streaming reply. Otherwise it exits.
  terminal.on("SIGINT", () => (interrupt ? interrupt() : terminal.close()));

  const io: Io = {
    write: (text) => process.stdout.write(text),
    readLine: async (prompt) => {
      // With piped input the terminal can close while read lines are still queued.
      if (!closed) {
        terminal.setPrompt(prompt);
        terminal.prompt();
      }
      const { done, value } = await lines.next();
      return done ? undefined : value;
    },
    onInterrupt: (handler) => {
      interrupt = handler;
    },
  };

  const session = new Session(api, io, me);
  session.print(bold("Welcome to edven-ai"));
  session.print();
  session.print(`Authenticated as: ${me.email}`);
  session.print(`Active Agent: ${session.agent.name}`);
  session.print(`Active Model: ${session.modelName()}`);
  session.print(dim("Type /help for commands."));
  session.print();

  while (session.running) {
    const line = await io.readLine("> ");
    if (line === undefined) break;
    await handleLine(session, line);
  }
  terminal.close();
}
