<div align="center">

<br/>

```
██╗   ██╗ █████╗ ██████╗      ██╗ █████╗ ███╗   ██╗██╗██╗  ██╗
██║   ██║██╔══██╗██╔══██╗     ██║██╔══██╗████╗  ██║██║╚██╗██╔╝
██║   ██║███████║██║  ██║     ██║███████║██╔██╗ ██║██║ ╚███╔╝
╚██╗ ██╔╝██╔══██║██║  ██║██   ██║██╔══██║██║╚██╗██║██║ ██╔██╗
 ╚████╔╝ ██║  ██║██████╔╝╚█████╔╝██║  ██║██║ ╚████║██║██╔╝ ██╗
  ╚═══╝  ╚═╝  ╚═╝╚═════╝  ╚════╝ ╚═╝  ╚═╝╚═╝  ╚═══╝╚═╝╚═╝  ╚═╝
```

### **The Zero-Trust Autonomous Swarm Orchestrator**

*Your machine. Your rules. Your agents. Nobody watching.*

<br/>

[![License: MIT](https://img.shields.io/badge/License-MIT-6C63FF.svg?style=for-the-badge)](https://github.com/RajKumarSidwadkar/Vadjanix/blob/main/LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-v18+-43853D.svg?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org)
[![Powered by Gemini](https://img.shields.io/badge/Gemini-2.5%20Flash-FF6D00.svg?style=for-the-badge&logo=google&logoColor=white)](https://deepmind.google/technologies/gemini/)
[![Status](https://img.shields.io/badge/Status-Active%20Development-00C853.svg?style=for-the-badge)](https://github.com/RajKumarSidwadkar/Vadjanix)
[![PRs Welcome](https://img.shields.io/badge/PRs-Welcome-brightgreen.svg?style=for-the-badge)](https://github.com/RajKumarSidwadkar/Vadjanix/pulls)

<br/>

[**Quick Start**](#-5-line-quickstart) · [**Architecture**](#-core-architecture) · [**Use Cases**](#-concrete-use-cases) · [**Roadmap**](#-roadmap) · [**Contributing**](#-contributing)

<br/>

</div>

---

## The Problem with Every Other Agent Framework

Every major AI agent framework — LangChain, AutoGen, CrewAI, OpenClaw — makes the same fundamental assumption: **your compute, your data, and your decisions should live in the cloud.**

They hand your API keys to their servers. They route your prompts through their infrastructure. They decide what your agent can and cannot do. And when their service goes down, your agent goes silent.

**Vadjanix rejects this entirely.**

Vadjanix is a **sovereign agent protocol** built on a single belief: the most powerful AI system is one that runs on your hardware, answers only to your rules, and communicates with the world on your terms — cryptographically signed, zero-trust verified, and architecturally impossible for any third party to surveil or shut down.

---

## What Vadjanix Is

```
One message from your phone.
Your agent wakes up.
Checks your rules. Checks your memory.
Fans out to a parallel swarm of specialists.
Negotiates, executes, aggregates.
Writes back to your local audit log.
You never touched a keyboard.
```

Vadjanix is a **local-first, zero-trust multi-agent orchestrator** that connects external messaging interfaces — Telegram, Nostr relays, terminal — directly to your machine's native execution environment through a strictly typed `IntentPacket` routing layer, a cryptographically verified edge bouncer, and a parallel swarm engine that coordinates specialized sub-agents without ever leaving your control.

---

## Why Vadjanix Is Different

| Capability | Every Other Framework | Vadjanix |
|:---|:---|:---|
| **Execution** | Cloud-dependent, hosted | 100% local native — Node.js on your machine |
| **Security model** | API-key authenticated | Zero-Trust Edge Router — cryptographic + ID whitelist |
| **Agent routing** | Centralized, serial | Decentralized swarm fan-out via `Promise.all` parallelization |
| **State resolution** | Black-box LLM output | Deterministic aggregation — `first_wins`, `consensus`, `merge` |
| **System access** | Sandboxed, restricted | Direct OS tool execution — RAM, filesystem, Docker, bash |
| **External interfaces** | Web GUI, cloud dashboard | Native telemetry — Telegram webhooks, Nostr relay protocol |
| **Data sovereignty** | Your data on their servers | Your data never leaves your machine |
| **Shutdown risk** | Their server goes down, you're offline | Nobody can turn off what they don't control |
| **Ethics layer** | System prompts you can't audit | Human-readable `PRINCIPLES.md` — edit in plain English |
| **Memory** | Ephemeral or cloud-stored | Local Markdown — append-only, fully auditable |

---

## 🎥 See It in Action

> **Demo GIF coming** — 60 seconds: a Telegram message triggers a local swarm that checks server RAM, negotiates a freelance contract, fans out to three parallel sub-agents, and writes the result to a local audit log. Zero cloud. Zero latency tax. Zero trust required.

---

## 🧠 Core Architecture

Vadjanix is built on a five-layer unidirectional data flow. Every packet that enters the system is typed, signed, validated, and routed deterministically — no black boxes, no surprises.

```
╔══════════════════════════════════════════════════════════════════════╗
║                    VADJANIX — LOCAL SOVEREIGN MACHINE                ║
║                                                                      ║
║  ┌─────────────┐   ┌─────────────┐   ┌──────────────────────────┐    ║
║  │    SOUL     │   │   MEMORY    │   │   Docker Security Sandbox│    ║
║  │─────────────│   │─────────────│   │──────────────────────────│    ║
║  │PRINCIPLES.md│   │ profile.md  │   │  ┌────────────────────┐  │    ║
║  │BOUNDARIES.md│   │context_log  │   │  │     BRAIN          │  │    ║
║  │             │   │  deals.md   │   │  │  engine.ts         │  │    ║
║  │ Human edits │   │ audit_log   │   │  │  Pre-check gate    │  │    ║
║  │ plain text  │   │ swarm_log   │   │  │  State machine     │  │    ║
║  └──────┬──────┘   └──────┬──────┘   │  │  Zod validator     │  │    ║
║         │                 │          │  │  LLM reasoning loop│  │    ║
║         └────────┬─────────┘          │  └────────┬───────────┘ │    ║
║                  │ soul + memory      │           │             │    ║
║                  └─────────────────── ▶ ───────────┘            │   ║
║                                       └──────────────────────────┘   ║
║                                                  │                   ║
║                              ┌───────────────────▼──────────────┐    ║
║                              │     INTENT PACKET ROUTER         │    ║
║                              │  IntentPacket: from·to·action    │    ║
║                              │  Nostr auth sign · Zod check     │    ║
║                              │  URL prefix switcher (50 lines)  │    ║
║                              └────┬──────┬──────┬───────┬───────┘    ║
║                                   │      │      │       │            ║
║             vadjanix:// ──────────┘  db://  file://  https://        ║
║             google-a2a://                        mcp://              ║
║                                                                      ║
║                              ┌───────────────────────────────────┐   ║
║                              │     VOICE — NOSTR TRANSPORT       │   ║
║                              │  Keypair · Agent Card · Relay     │   ║
║                              │  Reputation score · Discovery     │   ║
║                              └───────────────────────────────────┘   ║
╚══════════════════════════════════════════════════════════════════════╝
                                        │
                        ┌───────────────▼────────────────┐
                        │         EXTERNAL WORLD         │
                        │  Telegram · Nostr · REST APIs  │
                        │  SQL/NoSQL · MCP tools · Files │
                        │  Google A2A · OpenAI agents    │
                        └────────────────────────────────┘
```

### Layer breakdown

**The Soul** — `PRINCIPLES.md` and `BOUNDARIES.md` are plain Markdown files you write in English. They define what your agent is allowed to do, how it negotiates, and what lines it will never cross. No code. No prompt engineering. Edit them in any text editor. The LLM reads them at startup and treats them as law.

**The Memory** — Five append-only Markdown files that give your agent context across sessions: who you are (`profile.md`), your negotiation history (`context_log.md`), every deal outcome (`deals.md`), a full reasoning audit trail (`audit_log.md`), and swarm execution logs (`swarm_log.md`). Human-readable. Version-controllable. Yours forever.

**The Brain** — `engine.ts` runs a deterministic pre-check against your soul rules before calling the LLM — meaning hard limits are enforced in code, not left to model judgment. Then a typed state machine handles `Propose → Counter → Accept/Reject`. Every LLM output is Zod-validated before the system acts on it.

**The Router** — A 50-line URL-prefix switcher that routes `IntentPacket` objects to any target: another Vadjanix agent (`vadjanix://`), a database (`db://`), a local file (`file://`), an MCP tool (`mcp://`), or any REST API (`https://`). No LLM involved in routing. No SDK per integration. Cryptographic auth is a separate signed field — credentials never appear in the payload.

**The Voice** — A Nostr-based transport layer that signs every outbound packet with your agent's private key. Your agent has a permanent cryptographic identity. Other agents can discover it via an Agent Card. Your reputation score accumulates as a signed Nostr event. No central server required. Nobody can impersonate you.

**The Swarm Engine** — For complex tasks, the Brain fans out to parallel specialist sub-agents via `Promise.all`. Results are aggregated deterministically: `first_wins` for speed-critical tasks, `consensus` for factual queries, `merge` for creative synthesis. Partial failures time out gracefully — the swarm continues with surviving agents.

---

## 🛠️ Concrete Use Cases

### The Secure DevOps Admin
Text your bot from your phone at 2am: *"Is the server still up?"*
Vadjanix checks RAM, CPU, Docker container status, and error logs — locally, natively — and sends you a formatted report in 4 seconds. No SSH. No VPN. No third-party monitoring service that has access to your infrastructure.

### The Autonomous Freelance Negotiator
A job appears on a bounty board overnight. Your Vadjanix agent reads it, checks your `BOUNDARIES.md` for your minimum rate, fans out a swarm to evaluate the scope, and negotiates a contract — 20% deposit clause included — before you wake up. `deals.md` has the full record. You review, you sign off. The agent did the work.

### The Uncensorable Research Swarm
Ask a complex technical or strategic question. Vadjanix spins up a parallel swarm of sub-agents — Researcher, Analyst, Devil's Advocate — each working independently. The Brain aggregates their findings using a consensus algorithm. You get a multi-perspective answer in seconds, synthesized locally, never uploaded anywhere.

### The Private Data Analyst
Point Vadjanix at a local CSV or SQLite database. Ask questions in plain English over Telegram. Your proprietary data never leaves your machine. No OpenAI. No Google. No Terms of Service that claim rights to your data.

### The Sovereign Diplomat
Two Vadjanix agents — one representing you, one representing a counterparty — negotiate scheduling, contracts, or resource allocation directly over Nostr. Cryptographically signed. Auditable. No platform intermediary. The deal is settled before either human opens their laptop.

---

## ⚡ 5-Line Quickstart

```bash
git clone https://github.com/RajSidwadkar/Vadjanix.git
cd Vadjanix
npm install
cp .env.example .env    # Add your Gemini API & Telegram keys
npm run dev
```

You're running in under 60 seconds.

---

## 📖 Full Setup Guide

### Prerequisites

| Requirement | Version | Purpose |
|:---|:---|:---|
| Node.js | v18+ | Runtime |
| Ngrok | Latest | Telegram webhook tunnel |
| Gemini API Key | — | LLM reasoning engine |
| Telegram Bot Token | — | Primary messaging interface |

### Environment configuration

Create a `.env` file in the root directory:

```env
PORT=3000
GEMINI_API_KEY="your_google_ai_studio_key"
TELEGRAM_BOT_TOKEN="your_botfather_token"
TELEGRAM_WHITELIST="your_chat_id"   # Critical: comma-separated allowed user IDs
```

> The `TELEGRAM_WHITELIST` is your Zero-Trust gate. Any message from an ID not on this list is dropped at the edge — before it reaches the LLM, before it touches your tools, before it costs you a single API call.

### Wiring the Telegram tunnel

```bash
# Terminal 1 — start Vadjanix
npm run dev

# Terminal 2 — open the tunnel
ngrok http 3000
```

Copy the `https://` forwarding URL Ngrok gives you, then register the webhook:

```
https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook?url=<NGROK_URL>/webhook/telegram
```

Send your bot a message. The Zero-Trust router authenticates your ID and responds. You're live.

---

## 🧰 The Tool Registry

The Brain is infinitely extensible. Every new capability you give your agent is one new file in `src/tools/`.

**Built-in tools:**

| Tool | What it does |
|:---|:---|
| `get_system_status` | Reads native OS metrics — RAM, platform, uptime — and feeds structured data to the LLM |

**Adding a new tool — three steps:**

```typescript
// 1. Write the function in src/tools/your_tool.ts
export async function yourTool(params: YourParams): Promise<string> {
  // your native Node.js logic here
}

// 2. Export the Gemini FunctionDeclaration
export const yourToolDeclaration: FunctionDeclaration = {
  name: "your_tool",
  description: "What this tool does in one sentence",
  parameters: { ... }
}

// 3. Inject into src/brain/chat.ts
import { yourTool, yourToolDeclaration } from "../tools/your_tool";
// add to tools array — done.
```

The Brain discovers it automatically on next boot. No registration. No config files. No restart required in development.

---

## 📦 The IntentPacket — Universal Routing Schema

Every communication in Vadjanix — whether it's a negotiation with another agent, a database query, a file read, or a REST API call — flows through one typed object:

```typescript
type IntentPacket = {
  from:      string    // cryptographic agent identity
  to:        string    // target address — URL prefix determines handler
  action:    "read" | "write" | "propose" | "query" | "call"
  payload:   object    // the actual data
  auth?:     string    // Nostr-signed token — never inside payload
  reply_to?: string    // where to send the response
}
```

**The router handles the rest:**

```typescript
// vadjanix://  →  Nostr relay (agent-to-agent)
// db://        →  dbExecute  (SQL / NoSQL)
// file://      →  fileHandler (soul + memory files)
// mcp://       →  mcpCall    (MCP tool servers)
// https://     →  native fetch (any REST API)
```

50 lines. No LLM in the routing path. No SDK per integration. Typed error codes back to the engine on every response.

---

## 🗺️ Roadmap

### Phase 1 — Sovereign Diplomat *(current)*
- [x] Zero-Trust Edge Router with ID whitelist
- [x] IntentPacket universal routing schema
- [x] Nostr cryptographic agent identity
- [x] Soul layer — PRINCIPLES.md + BOUNDARIES.md
- [x] Memory layer — context_log, deals, audit trail
- [x] Deterministic pre-check gate (no LLM for hard rules)
- [x] Telegram + Nostr messaging interfaces
- [x] Native OS tool execution (RAM, platform, uptime)

### Phase 2 — Swarm Orchestrator *(active development)*
- [ ] Intent classifier — auto-route single vs. swarm tasks
- [ ] Parallel swarm fan-out via existing router
- [ ] Three aggregator modes — first_wins, consensus, merge
- [ ] Partial failure handling with graceful timeout
- [ ] `swarm_log.md` — per-run audit of sub-agent outcomes

### Phase 3 — God Mode *(next)*
- [ ] Full filesystem read/write tool
- [ ] Safe shell execution sandbox
- [ ] Docker container management tool
- [ ] Persistent memory — lightweight SQLite vector store
- [ ] Bridge adapters — Google A2A, OpenAI Agents, Discord, Slack

### Phase 4 — The Sovereign Internet *(vision)*
- [ ] Agent reputation system — signed Nostr reputation scores
- [ ] Agent Card discovery — find and verify other Vadjanix agents
- [ ] Cross-platform negotiation — your agent settles contracts with any A2A-compatible agent
- [ ] `vadjanix.cloud` — visual soul editor and negotiation dashboard for non-technical users

---

## 🤝 Contributing

Vadjanix is open source and built in public. Contributions are welcome — especially in these areas:

- **New Tool Registry entries** — filesystem, Docker, calendar, payment systems
- **Swarm aggregator algorithms** — smarter consensus, semantic merge strategies
- **New webhook adapters** — Discord, Slack, WhatsApp, Matrix
- **Bridge adapters** — Google A2A, OpenAI Agents, LangChain interop
- **Performance** — router latency profiling, Nostr relay optimization

```bash
# Getting started
git fork https://github.com/RajSidwadkar/Vadjanix
git checkout -b feature/your-feature-name
git commit -m "feat: describe your change clearly"
git push origin feature/your-feature-name
# Open a Pull Request — describe what it does and why
```

Please read `CONTRIBUTING.md` before submitting. All PRs go through the Zero-Trust review process — meaning they must pass CI, include tests for new tools, and not introduce network calls in the routing path.

---

## 📄 License

Distributed under the **MIT License** — use it, fork it, build on it, sell it.
See [`LICENSE`](https://github.com/RajSidwadkar/Vadjanix/blob/main/LICENSE) for details.

---

## 🧭 The Philosophy

The AI industry is converging on a world where every agent routes through someone else's cloud, every negotiation is logged on someone else's server, and every capability your agent has is a permission granted by a platform that can revoke it tomorrow.

Vadjanix is built on the opposite bet:

> **Trust is the bottleneck of AI adoption.** People won't give their agents real power until they can see exactly what those agents are doing, verify exactly who they're talking to, and guarantee that no third party can observe, intercept, or shut down the conversation.

Vadjanix makes the agent's reasoning visible in plain Markdown. It makes the agent's identity verifiable with cryptography. It makes the agent's communication decentralized and censorship-resistant via Nostr. And it makes the agent's ethics editable in plain English by the person who owns it.

Not a black box. A trusted diplomat.

---

<div align="center">

<br/>

**Built with intention by [Raj Kumar Sidwadkar](https://github.com/RajSidwadkar)**

*Vadjanix doesn't install adapters. It routes intentions.*

<br/>

[![Star on GitHub](https://img.shields.io/github/stars/RajSidwadkar/Vadjanix?style=for-the-badge&logo=github&label=Star%20on%20GitHub)](https://github.com/RajSidwadkar/Vadjanix)

<br/>

</div>
