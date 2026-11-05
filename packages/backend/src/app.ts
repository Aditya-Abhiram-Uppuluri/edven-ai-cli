import type { AgentId, ChatEvent, ChatRequest, ConversationSummary, MeResponse } from "@edven-ai/protocol";
import Fastify, { type FastifyServerOptions } from "fastify";
import { type Agent, AGENTS, canUseAgent, toAgentInfo } from "./agents.ts";
import type { Authenticate, User } from "./auth.ts";
import { type Conversation, ConversationStore } from "./conversations.ts";
import type { Model } from "./models.ts";
import { ProviderError } from "./providers/types.ts";

declare module "fastify" {
  interface FastifyRequest {
    user: User;
  }
}

interface AppOptions {
  authenticate: Authenticate;
  models: Model[];
  agents?: Record<AgentId, Agent>;
  logger?: FastifyServerOptions["logger"];
}

const chatBodySchema = {
  type: "object",
  required: ["agent", "model", "message"],
  additionalProperties: false,
  properties: {
    agent: { type: "string", enum: Object.keys(AGENTS) },
    model: { type: "string", maxLength: 100 },
    message: { type: "string", minLength: 1, maxLength: 200_000 },
    conversationId: { type: "string", maxLength: 100 },
  },
};

function summarize({ id, agent, title, updatedAt }: Conversation): ConversationSummary {
  return { id, agent, title, updatedAt };
}

export function buildApp({ authenticate, models, agents = AGENTS, logger = false }: AppOptions) {
  const app = Fastify({ logger, bodyLimit: 1024 * 1024 });
  const conversations = new ConversationStore();

  app.get("/health", async () => ({ status: "ok" }));

  app.register(async (v1) => {
    v1.decorateRequest("user", undefined as unknown as User);
    v1.addHook("preHandler", async (request, reply) => {
      const user = await authenticate(request);
      if (!user) return reply.code(401).send({ error: "Sign in required." });
      request.user = user;
    });

    v1.get("/me", async (request): Promise<MeResponse> => {
      const { email, roles } = request.user;
      return {
        email,
        roles,
        agents: Object.values(agents)
          .filter((agent) => canUseAgent(request.user, agent))
          .map(toAgentInfo),
        models: models.map(({ id, name }) => ({ id, name })),
        defaultModel: models[0]?.id ?? null,
      };
    });

    v1.get("/conversations", async (request) =>
      conversations.list(request.user.email).map(summarize),
    );

    v1.get<{ Params: { id: string } }>("/conversations/:id", async (request, reply) => {
      const conversation = conversations.get(request.params.id, request.user.email);
      if (!conversation) return reply.code(404).send({ error: "Conversation not found." });
      return { ...summarize(conversation), messages: conversation.messages };
    });

    v1.post<{ Body: ChatRequest }>(
      "/chat",
      { schema: { body: chatBodySchema } },
      async (request, reply) => {
        const { model: modelId, message, conversationId } = request.body;
        const agent = agents[request.body.agent];

        // Authorization comes first, so denied users learn nothing else about the agent.
        if (!canUseAgent(request.user, agent)) {
          return reply.code(403).send({ error: `You don't have access to the ${agent.name} agent.` });
        }
        if (!agent.available) {
          return reply.code(409).send({ error: `The ${agent.name} agent isn't available yet.` });
        }
        const model = models.find(({ id }) => id === modelId);
        if (!model) {
          return reply.code(400).send({ error: `Model not available: ${modelId}` });
        }

        let conversation: Conversation;
        if (conversationId) {
          const existing = conversations.get(conversationId, request.user.email);
          if (!existing) return reply.code(404).send({ error: "Conversation not found." });
          // One agent per conversation, so one agent's context can't carry into another's.
          if (existing.agent !== agent.id) {
            return reply.code(409).send({ error: "This conversation belongs to a different agent." });
          }
          conversation = existing;
        } else {
          conversation = conversations.create(request.user.email, agent.id, message);
        }

        const abort = new AbortController();
        reply.raw.on("close", () => abort.abort());

        reply.hijack();
        reply.raw.writeHead(200, {
          "content-type": "text/event-stream",
          "cache-control": "no-cache",
          "x-accel-buffering": "no",
        });
        const send = (event: ChatEvent) => reply.raw.write(`data: ${JSON.stringify(event)}\n\n`);

        send({ type: "start", conversationId: conversation.id });
        let text = "";
        try {
          const stream = model.stream({
            model: model.id,
            system: agent.systemPrompt,
            messages: [...conversation.messages, { role: "user", content: message }],
            signal: abort.signal,
          });
          for await (const chunk of stream) {
            text += chunk;
            send({ type: "text", text: chunk });
          }
          conversations.appendTurn(conversation, message, text);
          // Metadata only: prompts and replies may hold employee data, so they stay out of logs.
          request.log.info(
            { user: request.user.email, agent: agent.id, model: model.id, conversation: conversation.id },
            "chat completed",
          );
          send({ type: "done" });
        } catch (error) {
          if (!abort.signal.aborted) {
            const { name, status } = error as { name?: string; status?: number };
            request.log.error({ errorName: name, status, model: model.id }, "chat failed");
            send({
              type: "error",
              message:
                error instanceof ProviderError
                  ? error.message
                  : "The model request failed. Please try again.",
            });
          }
        }
        reply.raw.end();
      },
    );
  }, { prefix: "/v1" });

  return app;
}
