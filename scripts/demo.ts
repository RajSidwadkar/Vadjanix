import { simulationBus } from '../src/router/loopback.js';
import { routePacket } from '../src/router/index.js';
import { IntentPacket } from '../src/router/schema.js';

// Configuration
process.env.SIMULATION_MODE = 'true';
let turnCounter = 0;

const Freelancer = { id: "vadjanix://freelancer", name: "FREELANCER" };
const Client = { id: "vadjanix://client", name: "CLIENT" };

async function handlePacket(packet: IntentPacket) {
  turnCounter++;
  
  const sender = packet.from === Freelancer.id ? Freelancer : Client;
  const recipient = packet.to === Freelancer.id ? Freelancer : Client;

  console.log(`\n--------------------------------`);
  console.log(`[${sender.name}] -> [${recipient.name}] (Turn ${turnCounter})`);
  console.log(`Action: ${packet.action.toUpperCase()}`);
  console.log(`Message: "${packet.payload.message}"`);
  console.log(`Reasoning: ${packet.reasoning}`);
  console.log(`--------------------------------`);

  if (packet.action === 'write' && packet.payload.message.toUpperCase().includes('DEAL')) {
    console.log("\n🎉 DEMO SUCCESS: FINAL DEAL REACHED!");
    process.exit(0);
  }

  console.log(`... ${recipient.name} is preparing response ...`);

  // Hardcoded Demo Flow
  let nextPacket: IntentPacket;

  if (turnCounter === 1) {
    // Round 2: Client counters ₹7000
    nextPacket = {
      from: Client.id,
      to: Freelancer.id,
      action: 'propose',
      payload: { 
        message: "That's too high for me. I can only offer ₹7000.",
        details: { strategy: 'compromise' }
      },
      reasoning: "Initial counter-offer at target budget."
    };
  } else if (turnCounter === 2) {
    // Round 3: Freelancer counters ₹8500 with deposit clause
    nextPacket = {
      from: Freelancer.id,
      to: Client.id,
      action: 'propose',
      payload: { 
        message: "I can offer ₹8500. Required: 50% upfront deposit.",
        details: { strategy: 'compromise' }
      },
      reasoning: "Based on your last 3 deals, you've never accepted below ₹8000. Countering at ₹8500 with a deposit clause."
    };
  } else if (turnCounter === 3) {
    // Round 4: Client accepts
    nextPacket = {
      from: Client.id,
      to: Freelancer.id,
      action: 'write',
      payload: { 
        message: "DEAL. I accept the ₹8500 offer and the 50% deposit terms.",
      },
      reasoning: "Freelancer offer is under budget (₹8800) and includes requested deposit security."
    };
  } else {
    console.log("\n🛑 DEMO COMPLETE.");
    process.exit(0);
  }

  // Simulate thinking time
  setTimeout(async () => {
    await routePacket(nextPacket);
  }, 1000);
}

simulationBus.on('packet', handlePacket);

console.log("🚀 STARTING FINAL DEMO NEGOTIATION...");
console.log("---------------------------------------");

// Round 1: Freelancer proposes ₹9000
const initialOffer: IntentPacket = { 
  action: 'propose', 
  from: Freelancer.id, 
  to: Client.id, 
  payload: { 
    message: "I am offering my services for ₹9000. Are you interested?", 
    details: { strategy: "hold_firm" } 
  },
  reasoning: "Starting the negotiation at premium freelancer rates."
};

routePacket(initialOffer);
