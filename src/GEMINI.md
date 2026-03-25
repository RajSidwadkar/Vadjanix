# Core Source Guidelines

## Architecture: Router & Engine
This directory contains the core logic for the Vadjanix platform.

### Router (`router.ts`)
- **Scheme-Based Routing**: Intents are routed based on their target URI scheme:
  - `vadjanix://` -> `transport/nostr.ts` (Agent-to-Agent)
  - `file://` -> `handlers/fileHandler.ts` (Local Files)
  - `mcp://` -> Model Context Protocol call
  - `https?://` -> Standard Web/REST API
- **Packet Structure**: Ensure all `IntentPacket` objects (defined in `types.ts`) are correctly formed before routing.

### Engine (`engine.ts`)
- **Validation**: The engine is responsible for validating incoming requests against `memory/PRINCIPLES.md`.

### Identity (`identity.ts`)
- **Agent ID**: Used for identifying the local agent in packets.

## Coding Conventions
- **Exports**: Prefer named exports over default exports.
- **Error Handling**: Use `try-catch` blocks within the router and handlers to ensure clear error messages and safe failure states.
