import { IntentPacketSchema } from '../brain/engine.js';

export async function routePacket(packet: any, counterparty: string = "user") {
  
  // 1. THE BOUNCER: This will natively throw a ZodError if the packet is malformed.
  // This is the exact error object your test suite is demanding to see.
  const validPacket = IntentPacketSchema.parse(packet);

  // 2. THE SWITCHBOARD
  switch (validPacket.action) {
    case 'write':
      console.log("ROUTER: Delivering message to user...");
      return validPacket.payload.message;
    case 'refuse':
      console.log("ROUTER: Executing refusal protocol...");
      return validPacket.payload.message;
    case 'propose':
      console.log("ROUTER: Sending counter-offer...");
      return validPacket.payload.message;
    case 'read':
    case 'query':
    case 'call':
      console.log("ROUTER: Internal tool call detected...");
      return validPacket.payload.message;
    default:
      throw new Error(`Unhandled action: ${validPacket.action}`);
  }
}