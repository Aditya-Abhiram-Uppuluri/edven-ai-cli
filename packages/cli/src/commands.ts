import { BackendError } from "./api.ts";
import { bold, dim, red, type Session } from "./session.ts";

interface Command {
  name: string;
  usage?: string;
  description: string;
  run(session: Session, arg: string): Promise<void> | void;
}

/** Lets the user choose by list number or id. Returns undefined if nothing was chosen. */
async function choose<T extends { id: string; name: string }>(
  session: Session,
  title: string,
  items: T[],
  arg: string,
  label: (item: T) => string = ({ name }) => name,
): Promise<T | undefined> {
  let answer = arg;
  if (!answer) {
    session.print(title);
    items.forEach((item, index) => session.print(`  ${index + 1}. ${label(item)}`));
    answer = ((await session.io.readLine("Choose (Enter to cancel): ")) ?? "").trim();
    if (!answer) return undefined;
  }
  const lowered = answer.toLowerCase();
  const choice =
    items[Number(answer) - 1] ??
    items.find(({ id, name }) => id.toLowerCase() === lowered || name.toLowerCase() === lowered);
  if (!choice) session.print(red(`Not an option: ${answer}`));
  return choice;
}

function notConnected(session: Session): void {
  session.print(`Microsoft sign-in isn't connected yet. Signed in with a dev identity: ${session.me.email}`);
}

export const COMMANDS: Command[] = [
  { name: "login", description: "Authenticate with your company account", run: notConnected },
  { name: "logout", description: "End the current session", run: notConnected },
  {
    name: "agent",
    usage: "[name]",
    description: "Switch between authorized agents",
    async run(session, arg) {
      const agent = await choose(session, "Select an agent:", session.me.agents, arg, (item) =>
        `${item.name} ${dim(`- ${item.description}${item.available ? "" : " (not available yet)"}`)}`,
      );
      if (!agent) return;
      if (!agent.available) {
        session.print(`The ${agent.name} agent isn't available yet.`);
        return;
      }
      if (agent.id === session.agent.id) {
        session.print(`Already using the ${agent.name} agent.`);
        return;
      }
      session.agent = agent;
      session.conversationId = undefined;
      session.print(`Active agent: ${agent.name}. Started a new conversation.`);
    },
  },
  {
    name: "model",
    usage: "[name]",
    description: "Select an available LLM",
    async run(session, arg) {
      const model = await choose(session, "Select a model:", session.me.models, arg);
      if (!model) return;
      session.model = model.id;
      session.print(`Active model: ${model.name}`);
    },
  },
  {
    name: "new",
    description: "Start a new conversation",
    run(session) {
      session.conversationId = undefined;
      session.print("Started a new conversation.");
    },
  },
  {
    name: "history",
    usage: "[number]",
    description: "View past conversations, or reopen one by number",
    async run(session, arg) {
      const conversations = await session.api.conversations();
      if (conversations.length === 0) {
        session.print("No conversations yet.");
        return;
      }
      if (!arg) {
        conversations.forEach(({ title, agent, updatedAt }, index) =>
          session.print(`  ${index + 1}. ${title} ${dim(`(${agent}, ${new Date(updatedAt).toLocaleString()})`)}`),
        );
        session.print(dim("Reopen one with /history <number>."));
        return;
      }
      const summary = conversations[Number(arg) - 1];
      if (!summary) {
        session.print(red(`No conversation ${arg}.`));
        return;
      }
      const agent = session.me.agents.find(({ id }) => id === summary.agent);
      if (!agent) {
        session.print(red(`You no longer have access to the ${summary.agent} agent.`));
        return;
      }
      const { messages } = await session.api.conversation(summary.id);
      for (const { role, content } of messages) {
        session.print(role === "user" ? bold(`> ${content}`) : content);
      }
      session.agent = agent;
      session.conversationId = summary.id;
    },
  },
  {
    name: "tools",
    description: "View the active agent's tools",
    run(session) {
      const { name, tools } = session.agent;
      session.print(tools.length ? tools.join("\n") : `The ${name} agent has no tools yet.`);
    },
  },
  {
    name: "help",
    description: "Display available commands",
    run(session) {
      for (const { name, usage, description } of COMMANDS) {
        session.print(`  ${`/${name}${usage ? ` ${usage}` : ""}`.padEnd(20)} ${dim(description)}`);
      }
    },
  },
  {
    name: "exit",
    description: "Exit edven-ai",
    run(session) {
      session.running = false;
    },
  },
];

export async function runCommand(session: Session, line: string): Promise<void> {
  const [name = "", ...rest] = line.slice(1).trim().split(/\s+/);
  const command = COMMANDS.find((candidate) => candidate.name === name.toLowerCase());
  if (!command) {
    session.print(`Unknown command: /${name}. Type /help for the list.`);
    return;
  }
  await command.run(session, rest.join(" "));
}

/** Backend failures are shown to the user and the session carries on. */
export async function handleLine(session: Session, line: string): Promise<void> {
  const input = line.trim();
  if (!input) return;
  try {
    if (input.startsWith("/")) await runCommand(session, input);
    else await session.send(input);
  } catch (error) {
    if (!(error instanceof BackendError)) throw error;
    session.print(red(error.message));
  }
}
