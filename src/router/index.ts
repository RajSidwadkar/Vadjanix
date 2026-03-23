// src/router/index.ts
import { IntentPacket, IntentPacketSchema } from '../types/index.js';
import { handleFile } from './handlers/fileHandler.js';
import { handleNostr } from '../voice/nostr.js';

export async function routePacket(rawPacket: any): Promise<any> {
  // 0. Zod Validation Guard
  const validation = IntentPacketSchema.safeParse(rawPacket);
  if (!validation.success) {
    throw new Error(`[VALIDATION ERROR] Malformed IntentPacket: ${validation.error.message}`);
  }

  const packet = validation.data;
  console.log(`[ROUTER] Routing intent from ${packet.from} -> ${packet.to}`);

  const { to, action, payload, auth } = packet;

  try {
    // 1. Agent-to-Agent (Nostr)
    if (to.startsWith("vadjanix://")) {
      // TODO: Verify auth signature here before sending
      return await handleNostr(packet);
    }

    // 2. Local File System
    if (to.startsWith("file://")) {
      return await handleFile(to, action, payload);
    }

    // 3. MCP Tooling
    if (to.startsWith("mcp://")) {
      console.log("[ROUTER] MCP tool call intercepted");
      // return await mcpCall(to, payload);
      return { status: "success", data: "MCP stub hit" };
    }

    // 4. Standard Web/REST API
    if (to.startsWith("https://") || to.startsWith("http://")) {
      const response = await fetch(to, {
        method: action === "read" ? "GET" : "POST",
        body: action === "read" ? undefined : JSON.stringify(payload),
        headers: { 
            "Content-Type": "application/json",
            "Authorization": auth ?? "" 
        }
      });
      return await response.json();
    }

    throw new Error(`[ROUTER] Unknown target scheme: ${to}`);

  } catch (error: any) {
    console.error(`[ROUTER ERROR] Failed to route to ${to}:`, error.message);
    return { error: error.message };
  }
}