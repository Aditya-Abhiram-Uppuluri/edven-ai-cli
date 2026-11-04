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
  Internal Docs    GitHub      Workforce APIs
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
| Runtime | Node.js |
| CLI | Interactive terminal framework |
| Backend | Node.js / Fastify |
| Authentication | Microsoft Entra ID |
| LLM Providers | Anthropic / OpenAI |
| Database | PostgreSQL |
| Vector Search | pgvector |
| Integrations | GitHub API, Microsoft Graph, EmPortal APIs |
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

The project is currently under development.

Installation instructions, local development commands, environment configuration, and deployment documentation will be added as the foundational implementation is completed.

## Project Philosophy

**One CLI. Three agents. Multiple models. Centralized security.**

edven-ai is designed around a simple principle: enterprise AI should be accessible, extensible, and secure, without adding unnecessary complexity to an employee's workflow.

The goal is to provide a unified interface for company knowledge and operational intelligence while ensuring that access to sensitive information and business operations always remains under organizational control.

---

**Developed by Edven | Internal Enterprise AI Initiative**
