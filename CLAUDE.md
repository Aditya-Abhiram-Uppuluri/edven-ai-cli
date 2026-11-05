# edven-ai

CLI-only internal AI assistant for Edvenswa. Employees run `edven-ai` on Windows/macOS/Linux. No GUI or web frontend. Thin CLI + centralized backend; organization Microsoft sign-in; selectable Claude/GPT models (others later).

## Agents
- **General** (default): company-docs Q&A/RAG and general chat.
- **Coding**: GitHub code search, analysis, reviews, and coding; writes require backend authorization and user approval.
- **EmPortal**: management-only, read-only employee/workforce queries via the EmPortal application's raw database.

## Non-negotiables
- Enforce authentication and role/resource/tool permissions **on the backend** for every request; never trust the CLI or model as an authorization boundary.
- Keep secrets out of source control and logs. Protect employee data with least privilege. Treat retrieved content as untrusted input.
- Keep model providers and integrations swappable, without speculative abstractions. Never invent APIs, schemas, or permissions; mock unavailable integrations.
- Prioritize a working MVP. Follow established language, tools, and conventions; no stack changes without approval.
- Get approval before destructive operations, external writes, or major architectural changes.

## 1. Think Before Coding
**Don't assume. Don't hide confusion. Surface tradeoffs.**
- State material assumptions. If uncertainty changes the implementation, ask.
- When interpretations differ, explain the options rather than choosing silently.
- Recommend simpler solutions and push back on unnecessary complexity.
- For trivial, unambiguous tasks, proceed without needless questions.

## 2. Simplicity First
**Minimum code that solves the problem. Nothing speculative.**
- No unrequested features, single-use abstractions, or speculative configuration.
- Avoid error handling for impossible scenarios; handle realistic failure and security cases.
- If 200 lines could be 50 without sacrificing clarity or correctness, simplify.

## 3. Surgical Changes
**Touch only what you must. Clean up only your own mess.**
- Inspect relevant code before editing; match existing style.
- Don't refactor, reformat, or remove unrelated code.
- Remove imports, variables, and functions made unused by your changes; mention unrelated dead code instead of deleting it.
- Every changed line should trace to the request.

## 4. Goal-Driven Execution
**Define success criteria. Loop until verified.**
- For multi-step work, briefly state steps and how each will be verified.
- For bugs, reproduce with a test first when practical; for validation, test invalid inputs; for refactors, test before and after.
- Run relevant tests and checks. Report changes, results, and blockers concisely; never claim unrun tests passed.