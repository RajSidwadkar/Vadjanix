import { EventEmitter } from 'events';
import { IntentPacket } from './schema.js';

/**
 * SimulationBus: A singleton event emitter that acts as a loopback transport
 * for in-memory agent-to-agent negotiation.
 */
class SimulationBus extends EventEmitter {}
export const simulationBus = new SimulationBus();

/**
 * Mock send function for simulation.
 * Emits the packet to the bus.
 */
export async function loopbackSend(packet: IntentPacket): Promise<any> {
  console.log(`[LOOPBACK] Sending packet: ${packet.action} to ${packet.to}`);
  simulationBus.emit('packet', packet);
  return { success: true, status: 200, data: { message: "Packet routed via loopback" } };
}

/**
 * Mock listen function for simulation.
 * @param callback Function to call when a packet is received.
 */
export function loopbackListen(callback: (packet: IntentPacket) => void) {
  simulationBus.on('packet', callback);
}
