// Wire types shared by the CLI and backend. Types only: nothing here exists at runtime.

export type AgentId = "general" | "coding" | "emportal";

export interface AgentInfo {
  id: AgentId;
  name: string;
  description: string;
  /** False until the agent is built. Selecting it is refused by the backend. */
  available: boolean;
  tools: string[];
}

export interface ModelInfo {
  id: string;
  name: string;
}

export interface MeResponse {
  email: string;
  roles: string[];
  /** Only the agents this user is permitted to use. */
  agents: AgentInfo[];
  /** Only the models currently enabled on the backend. */
  models: ModelInfo[];
  defaultModel: string | null;
}

export interface ChatRequest {
  agent: AgentId;
  model: string;
  message: string;
  /** Omit to start a new conversation. */
  conversationId?: string;
}

export type ChatEvent =
  | { type: "start"; conversationId: string }
  | { type: "text"; text: string }
  | { type: "done" }
  | { type: "error"; message: string };

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ConversationSummary {
  id: string;
  agent: AgentId;
  title: string;
  updatedAt: string;
}

export interface ConversationDetail extends ConversationSummary {
  messages: ChatMessage[];
}

export interface ApiError {
  error: string;
}
