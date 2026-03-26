import { IntentPacketSchema, IntentPacket, RouterResult } from './schema.js';
import { verifyPacketSignature } from '../voice/crypto.js';
import { nostrSend } from '../voice/nostr.js';
import { loopbackSend } from './loopback.js';
import { routeToGoogleA2A, routeToOpenAIAgent } from './adapters.js';
import { ZodError } from 'zod';

const AUTHORIZED_PUBKEY = process.env.VADJANIX_PUBKEY || "dummy_hex_key";

export async function routePacket(rawPacket: unknown): Promise<RouterResult> {
  try {
    // 1. Validation Phase
    let validPacket: IntentPacket;
    try {
      validPacket = IntentPacketSchema.parse(rawPacket);
    } catch (e) {
      if (e instanceof ZodError) {
        return { success: false, status: 400, error: `VALIDATION ERROR: ${e.message}` };
      }
      return { success: false, status: 400, error: "VALIDATION ERROR: Unknown error during parsing." };
    }

    // 2. Parse URL
    let url: URL;
    try {
      url = new URL(validPacket.to);
    } catch (e) {
      return { success: false, status: 400, error: `MALFORMED URL: ${validPacket.to}` };
    }
    const targetProtocol = url.protocol;

    // 3. Auth Phase (Nostr)
    if (targetProtocol === 'vadjanix:' && validPacket.from !== 'vadjanix://brain' && process.env.SIMULATION_MODE !== 'true') {
      const currentPubkey = process.env.VADJANIX_PUBKEY || "dummy_hex_key";
      if (!validPacket.auth) {
        return { success: false, status: 401, error: "SECURITY FATAL: Missing 'auth' field for external vadjanix packet." };
      }
      const isValid = await verifyPacketSignature(validPacket, currentPubkey);
      if (!isValid) {
        return { success: false, status: 401, error: "SECURITY FATAL: Invalid Nostr signature in auth field." };
      }
    }

    // 4. Switchboard
    switch (targetProtocol) {
      case 'vadjanix:':
        console.log("ROUTER: Vadjanix protocol routing message.");
        if (process.env.SIMULATION_MODE === 'true') {
          return await loopbackSend(validPacket);
        }
        const sendResult = await nostrSend(validPacket);
        if (sendResult) {
          return { success: true, status: 200, data: { message: "Packet broadcasted to Nostr network" } };
        } else {
          return { success: false, status: 502, error: "Failed to broadcast to Nostr relays" };
        }
      case 'db:':
        console.log("ROUTER: Database execution message.");
        return { success: true, status: 200, data: { protocol: 'db:', message: "Database operation mocked" } };
      case 'file:':
        console.log("ROUTER: File handler message.");
        return { success: true, status: 200, data: { protocol: 'file:', message: "File handler operation mocked" } };
      case 'mcp:':
        console.log("ROUTER: MCP call message.");
        return { success: true, status: 200, data: { protocol: 'mcp:', message: "MCP call operation mocked" } };
      case 'https:':
      case 'http:':
        console.log("ROUTER: Native Fetch message.");
        return { success: true, status: 200, data: { protocol: targetProtocol, message: "Fetch operation mocked" } };
      case 'google-a2a:':
        return await routeToGoogleA2A(validPacket);
      case 'openai-agent:':
        return await routeToOpenAIAgent(validPacket);
      default:
        return { success: false, status: 404, error: `ROUTING FATAL: Unsupported protocol prefix ${targetProtocol}` };
    }
  } catch (err: any) {
    return { success: false, status: 500, error: `CATASTROPHIC ERROR: ${err.message}` };
  }
}
