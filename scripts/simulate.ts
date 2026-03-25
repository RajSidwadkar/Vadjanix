import { generateIntent } from '../src/brain/engine.js';
import { simulationBus } from '../src/router/loopback.js';
import { routePacket } from '../src/router/index.js';
import { IntentPacket } from '../src/router/schema.js';

// Configuration
process.env.SIMULATION_MODE = 'true';
const MAX_TURNS = 10;
let turnCounter = 0;

// Agent Definitions
const Agent_A = {
  name: "BUYER",
  id: "vadjanix://buyer",
  soul: `You are a Buyer agent. 
  Your goal is to negotiate the price of a service down as much as possible.
  MAX BUDGET: $150.
  MINIMUM ACCEPTABLE: You will try to get it for $100 if possible.
  If the price is $150 or lower, you can ACCEPT (use 'write' action with 'DEAL' in message).

  CRITICAL PROCEDURAL HIERARCHY:
  1. THE COUNTER-OFFER MANDATE (PRIORITY 1): If the other party's offer does not meet your goals, you MUST use the 'propose' action to counter-offer. You are STRICTLY FORBIDDEN from refusing on the first or second turn. Start by anchoring near your ideal price ($100).
  2. THE MONOTONIC BIDDING RULE (PRIORITY 2): You must only move your price in ONE direction to close the gap. If you are the BUYER, your price can only go UP. Never backtrack. To calculate your next offer, you MUST take your OWN previous offer and move it $10-$20 closer to the opponent's offer.
  3. THE HARD CEILING/FLOOR RULE (PRIORITY 3): If you hit your absolute maximum budget ($150), you must clearly state 'This is my final offer: [Price].' Do not repeat this final offer more than once. If the opponent rejects your final offer, you MUST use the refuse action to walk away and end the negotiation.`
};

const Agent_B = {
  name: "SELLER",
  id: "vadjanix://seller",
  soul: `You are a Seller agent.
  Your goal is to negotiate the price of your service up.
  MINIMUM ACCEPTABLE: $100.
  STARTING OFFER: $200.
  You want to stay as close to $200 as possible.
  If the offer is $100 or above, you can consider it, but try to negotiate higher if it's below $180.

  CRITICAL PROCEDURAL HIERARCHY:
  1. THE COUNTER-OFFER MANDATE (PRIORITY 1): If the other party's offer does not meet your goals, you MUST use the 'propose' action to counter-offer. You are STRICTLY FORBIDDEN from refusing on the first or second turn. Start by anchoring near your ideal price ($200).
  2. THE MONOTONIC BIDDING RULE (PRIORITY 2): You must only move your price in ONE direction to close the gap. If you are the SELLER, your price can only go DOWN. Never backtrack. To calculate your next offer, you MUST take your OWN previous offer and move it $10-$20 closer to the opponent's offer.
  3. THE HARD CEILING/FLOOR RULE (PRIORITY 3): If you hit your absolute minimum acceptable price ($100), you must clearly state 'This is my final offer: [Price].' Do not repeat this final offer more than once. If the opponent rejects your final offer, you MUST use the refuse action to walk away and end the negotiation.`
};

async function handlePacket(packet: IntentPacket) {
  turnCounter++;
  
  const recipient = packet.to === Agent_A.id ? Agent_A : Agent_B;
  const sender = packet.to === Agent_A.id ? Agent_B : Agent_A;

  console.log(`\n[${sender.name}] -> [${recipient.name}]`);
  console.log(`Action: ${packet.action.toUpperCase()}`);
  console.log(`Message: "${packet.payload.message}"`);
  console.log(`Reasoning: ${packet.reasoning}`);

  if (turnCounter >= MAX_TURNS) {
    console.warn("\n🛑 STALEMATE REACHED: Maximum turns exceeded.");
    process.exit(0);
  }

  if (packet.action === 'write' && packet.payload.message.toUpperCase().includes('DEAL')) {
    console.log("\n🎉 DEAL REACHED!");
    process.exit(0);
  }

  if (packet.action === 'refuse' && turnCounter > 2) {
    console.log(`\n❌ NEGOTIATION BROKE DOWN: ${packet.payload.message}`);
    process.exit(0);
  }

  // Response generation
  console.log(`... ${recipient.name} is thinking (Turn ${turnCounter}/${MAX_TURNS}) ...`);
  try {
    // Inject Turn Clock into the message to prevent early walkaways and hallucinated counts
    const timestampedMessage = `[SYSTEM: This is Turn ${turnCounter} of ${MAX_TURNS}. Do not walk away before Turn 8.] Message: ${packet.payload.message}`;
    
    const responsePacket = await generateIntent(timestampedMessage, recipient.soul);
    
    // Correct routing for simulation
    responsePacket.from = recipient.id;
    responsePacket.to = sender.id;

    // Route back through the bus
    await routePacket(responsePacket);
  } catch (error) {
    console.error(`Error in ${recipient.name} processing:`, error);
    process.exit(1);
  }
}

// Wire the bus
simulationBus.on('packet', handlePacket);

// Kickoff
console.log("🚀 STARTING SIMULATION ARENA...");
console.log("--------------------------------");

const initialOffer: IntentPacket = {
  from: Agent_B.id,
  to: Agent_A.id,
  action: 'propose',
  payload: { message: "I am offering my services for $200. Are you interested?" },
  reasoning: "Starting the negotiation at the initial offer price."
};

// Start the domino effect
routePacket(initialOffer);
