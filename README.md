# edven-ai-cli

**Enterprise AI, directly from your terminal.**

edven-ai is a secure, cross-platform, multi-agent AI assistant designed to help employees and management interact with company knowledge, software repositories, and workforce management systems through a unified command-line interface.

Built with extensibility, security, and developer productivity in mind, edven-ai aims to bring enterprise AI capabilities directly into everyday workflows — without requiring a graphical interface.

> **Project Status:** Early development. The architecture and features described below represent the planned capabilities of the platform.

---

## Overview

edven-ai provides a single CLI application with three specialized AI agents:

| Agent | Purpose | Access |
|---|---|---|
| **General Agent** | General-purpose AI assistance and internal company knowledge retrieval | All authenticated employees, subject to document permissions |
| **Coding Agent** | GitHub repository intelligence, code assistance, PR reviews, and development workflows | Authorized engineering personnel |
| **EmPortal Agent** | Workforce intelligence, employee profiles, timesheets, attendance, and skills matching | Authorized management, read-only |

Employees will be able to switch agents and supported LLMs within the same terminal session.

## Key Features

### Multi-Agent Architecture

Three independently configured agents operating through a shared backend, with dedicated tools, instructions, and permission boundaries.

### Multi-Model Support

A model-agnostic architecture designed to support multiple LLM providers, including Anthropic Claude and OpenAI GPT models.

### Enterprise Authentication

Microsoft Entra ID integration for organizational authentication, with centralized role-based and resource-level authorization.

### GitHub Integration

Planned GitHub capabilities include:

- Repository and codebase exploration
- Pull request analysis and reviews
- Commit history and issue tracking
- CI/CD workflow and deployment status
- Authorized code changes and GitHub actions

### Internal Knowledge Retrieval

Retrieval-Augmented Generation (RAG) for searching internal documentation, company policies, technical resources, and organizational knowledge.

### Workforce Intelligence

Integration with EmPortal to provide management with authorized, read-only access to workforce information, including employee availability, attendance, timesheets, skills, and staffing insights.

### Cross-Platform CLI

Designed for Windows, macOS, and Linux, with a lightweight CLI communicating securely with a centralized backend.

---

## CLI Experience

The planned terminal experience:

```bash
edven-ai
```

```text
Welcome to edven-ai

Authenticated as: employee@company.com
Active Agent: General
Active Model: Claude Sonnet

> /agent

Select an agent:
  General Agent (Default)
  Coding Agent
  EmPortal Agent (Management only)

> /model

Select an available model:
  Claude Sonnet
  Claude Opus
  GPT

> How does our employee onboarding process work?
```

### Planned Commands

| Command | Description |
|---|---|
| `/login` | Authenticate with your company account |
| `/logout` | End the current session |
| `/agent` | Switch between authorized agents |
| `/model` | Select an available LLM |
| `/new` | Start a new conversation |
| `/history` | View conversation history |
| `/tools` | View available agent tools |
| `/help` | Display available commands |
| `/exit` | Exit edven-ai |

---

## Architecture

edven-ai follows a **thin-client, centralized-backend architecture**.

```text
             Employee Terminal
           (Windows/macOS/Linux)
                     |
                     v
                edven-ai CLI
                     |
                  HTTPS
                     |
                     v
              Central Backend
                     |
          +----------+----------+
          |                     |
    Authentication        Authorization
    (Microsoft Entra)     (Roles & Policies)
          |                     |
          +----------+----------+
                     |
               Agent Runtime
                     |
       +-------------+-------------+
       |             |             |
   General        Coding       EmPortal
    Agent          Agent         Agent
       |             |             |
  Internal Docs    GitHub      EmPortal DB
       |             |             |
       +-------------+-------------+
                     |
                LLM Router
                     |
              Claude / GPT
```

The LLM is responsible for selecting appropriate tools and generating responses. The backend independently validates permissions and executes authorized operations.

**The LLM never acts as the authorization authority.**

## Technology Stack

Planned technologies:

| Layer | Technology |
|---|---|
| Language | TypeScript |
| Runtime | Node.js 24+ (npm workspaces) |
| CLI | Node built-ins (`readline`), no runtime dependencies |
| Backend | Fastify |
| Authentication | Microsoft Entra ID |
| LLM Providers | Anthropic / OpenAI |
| Database | PostgreSQL |
| Vector Search | pgvector |
| Integrations | GitHub API, Microsoft Graph, EmPortal database (read-only) |
| Deployment | Docker / centralized hosting |

Technology choices may evolve during implementation.

---

## Security Principles

Security is a foundational part of the architecture.

- Microsoft-based organizational authentication
- Backend-enforced authorization
- Least-privilege tool access
- Role-based and resource-level permissions
- Read-only EmPortal access during initial development
- Explicit confirmation for GitHub write operations
- Secure management of API keys and credentials
- Tenant and customer data isolation
- Audit logging and usage monitoring
- Permission-aware internal document retrieval

The CLI will not store production integration credentials or independently authorize sensitive operations.

---

## Development Roadmap

- [ ] **Phase 1 — Foundation:** CLI, backend, authentication, authorization, agent registry, and model router
- [ ] **Phase 2 — General Agent:** LLM integration, document ingestion, search, and RAG
- [ ] **Phase 3 — Coding Agent:** GitHub integration, repository analysis, PR workflows, and controlled write operations
- [ ] **Phase 4 — EmPortal Agent:** Read-only workforce queries with management-specific access controls
- [ ] **Phase 5 — Deployment:** Cross-platform packaging, centralized hosting, security hardening, and employee rollout

## Getting Started

The CLI foundation runs locally with a fake dev identity. Microsoft sign-in, company documents, and the Coding and EmPortal agents aren't built yet. Their commands and agents appear in the CLI and report that they aren't available.

Requires Node.js 24 or later.

```bash
npm install
cp .env.example .env    # add ANTHROPIC_API_KEY and/or OPENAI_API_KEY for real models

npm run backend         # terminal 1
npm run cli             # terminal 2
```

Without API keys, the CLI offers a `Mock` model that echoes your message, so everything except real model replies works.

| Command | Purpose |
|---|---|
| `npm test` | Run all tests |
| `npm run typecheck` | Type-check all packages |
| `npm run build` | Compile to `packages/*/dist` |

### Code layout

| Path | Contents |
|---|---|
| `packages/cli` | The `edven-ai` terminal client. Slash commands live in `src/commands.ts` |
| `packages/backend` | Fastify API. Sign-in is in `src/auth.ts`, agents and their required roles in `src/agents.ts`, the model allowlist in `src/models.ts` |
| `packages/protocol` | Types shared by the CLI and backend |

The backend refuses to start unless `EDVEN_ENV=dev` and bound to localhost, until real authentication exists.

## Project Philosophy

**One CLI. Three agents. Multiple models. Centralized security.**

edven-ai is designed around a simple principle: enterprise AI should be accessible, extensible, and secure, without adding unnecessary complexity to an employee's workflow.

The goal is to provide a unified interface for company knowledge and operational intelligence while ensuring that access to sensitive information and business operations always remains under organizational control.

---

**Developed by Edven | Internal Enterprise AI Initiative**
