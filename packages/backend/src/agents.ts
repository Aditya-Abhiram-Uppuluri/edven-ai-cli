import type { AgentId, AgentInfo } from "@edven-ai/protocol";
import type { User } from "./auth.ts";

export interface Agent extends AgentInfo {
  /** App Role needed to use this agent. Null means any signed-in employee. */
  requiredRole: string | null;
  systemPrompt: string;
}

const BASE_PROMPT = "You are edven-ai, Edvenswa's internal AI assistant, used from a terminal.";

export const AGENTS: Record<AgentId, Agent> = {
  general: {
    id: "general",
    name: "General",
    description: "General chat and company knowledge",
    available: true,
    tools: [],
    requiredRole: null,
    systemPrompt: `${BASE_PROMPT} You don't have access to company documents yet. If asked about Edvenswa-specific information, say so instead of guessing.`,
  },
  coding: {
    id: "coding",
    name: "Coding",
    description: "GitHub code search, analysis, and reviews",
    available: false,
    tools: [],
    requiredRole: "Engineer",
    systemPrompt: BASE_PROMPT,
  },
  emportal: {
    id: "emportal",
    name: "EmPortal",
    description: "Read-only workforce queries (management only)",
    available: false,
    tools: [],
    requiredRole: "Manager",
    systemPrompt: BASE_PROMPT,
  },
};

export function canUseAgent(user: User, agent: Agent): boolean {
  return agent.requiredRole === null || user.roles.includes(agent.requiredRole);
}

export function toAgentInfo({ id, name, description, available, tools }: Agent): AgentInfo {
  return { id, name, description, available, tools };
}
