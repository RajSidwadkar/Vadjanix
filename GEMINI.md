# Vadjanix Project Guidelines

## Project Overview
Vadjanix is a TypeScript-based engine and router designed to manage intent-driven interactions, integrated with the **Nostr protocol** and **Model Context Protocol (MCP)**. It uses a core set of principles defined in `memory/PRINCIPLES.md` to validate actions and intents.

## Technical Stack
- **Language**: TypeScript
- **Runtime**: Node.js (ESM)
- **Protocols**: Nostr (`nostr-tools`), MCP (`@modelcontextprotocol/sdk`)
- **Validation**: Zod
- **Execution**: `tsx` (see `package.json` devDependencies)

## Coding Standards
- **ESM Modules**: Always use explicit `.js` extensions in relative imports (e.g., `import { foo } from './bar.js'`).
- **Typing**: Strict TypeScript. Use `zod` for runtime validation of external data or packets.
- **Principles**: All logic affecting user interactions or automated decisions MUST align with `memory/PRINCIPLES.md`.

## Workflow & Testing
- **Reproduce First**: Before fixing bugs, create a reproduction script (e.g., a small script run with `tsx`).
- **Validation**: Ensure any change to the router or engine is verified against the logic in `src/engine.ts`.
- **Tests**: Currently, the project lacks a formal test suite. Prefer adding unit tests for new logic in a `tests/` directory if possible.

## Interaction Principles
- Adhere to the core mandates in `memory/PRINCIPLES.md` when proposing or implementing features that involve scheduling, rates, or privacy.
