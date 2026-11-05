import { randomUUID } from "node:crypto";
import type { AgentId, ChatMessage } from "@edven-ai/protocol";

export interface Conversation {
  id: string;
  owner: string;
  agent: AgentId;
  title: string;
  updatedAt: string;
  messages: ChatMessage[];
}

/** In-memory for now: history is lost on restart. Postgres replaces this with the document store. */
export class ConversationStore {
  #conversations = new Map<string, Conversation>();

  /** Returns undefined for other users' conversations, so their existence isn't revealed. */
  get(id: string, owner: string): Conversation | undefined {
    const conversation = this.#conversations.get(id);
    return conversation?.owner === owner ? conversation : undefined;
  }

  list(owner: string): Conversation[] {
    return [...this.#conversations.values()]
      .filter((conversation) => conversation.owner === owner)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  create(owner: string, agent: AgentId, firstMessage: string): Conversation {
    const conversation: Conversation = {
      id: randomUUID(),
      owner,
      agent,
      title: firstMessage.slice(0, 60),
      updatedAt: new Date().toISOString(),
      messages: [],
    };
    return conversation;
  }

  /** Saves a finished turn. Failed or cancelled turns are never stored. */
  appendTurn(conversation: Conversation, userMessage: string, reply: string): void {
    conversation.messages.push(
      { role: "user", content: userMessage },
      { role: "assistant", content: reply },
    );
    conversation.updatedAt = new Date().toISOString();
    this.#conversations.set(conversation.id, conversation);
  }
}
