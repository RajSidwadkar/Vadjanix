import { generateIntent } from '../src/brain/engine.js';
import { simulationBus } from '../src/router/loopback.js';
import { routePacket } from '../src/router/index.js';
import { IntentPacket } from '../src/router/schema.js';
import { evaluateProposal } from '../src/brain/negotiator.js';

// Configuration
process.env.SIMULATION_MODE = 'true';
const MAX_TURNS = 10;
let turnCounter = 0;

// Negotiation State
let sellerLastOffer = 200;
let buyerLastOffer = 100;
const SELLER_LIMIT = 160;
const BUYER_LIMIT = 150;
const CONCESSION_STEP = 10;

// Agent Definitions
const Agent_A = {
  name: "BUYER",
  id: "vadjanix://buyer",
  soul: `You are a Buyer agent. 
  Your goal is to negotiate the price of a service down as much as possible.
  MAX BUDGET: $150.
  
  STRATEGY ENGINE MANDATE: You are the Strategy Engine. You cannot dictate prices. When negotiating, you must output one of three strategies: 'compromise' (to move closer to a deal), 'hold_firm' (to refuse to move), or 'walk_away' (to end negotiations). Evaluate the opponent's sentiment and choose a strategy.
  If the price is $150 or lower, you can ACCEPT (use 'write' action with 'DEAL' in message).`
};

const Agent_B = {
  name: "SELLER",
  id: "vadjanix://seller",
  soul: `You are a Seller agent.
  Your goal is to negotiate the price of your service up.
  MINIMUM ACCEPTABLE: $160.
  
  STRATEGY ENGINE MANDATE: You are the Strategy Engine. You cannot dictate prices. When negotiating, you must output one of three strategies: 'compromise' (to move closer to a deal), 'hold_firm' (to refuse to move), or 'walk_away' (to end negotiations). Evaluate the opponent's sentiment and choose a strategy.
  If the offer is $160 or above, you can consider it (use 'write' action with 'DEAL' in message).`
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
    const timestampedMessage = `[SYSTEM: This is Turn ${turnCounter} of ${MAX_TURNS}.] Message: ${packet.payload.message}`;
    
    let responsePacket: IntentPacket;
    try {
      responsePacket = await generateIntent(timestampedMessage, recipient.soul);
    } catch (error: any) {
      console.warn(`⚠️ LLM Failed validation or errored: ${error.message}. Falling back to deterministic calculator.`);
      // Fallback: Default to compromise if LLM fails (e.g. by including a rate)
      const role = recipient.id === Agent_A.id ? 'buyer' : 'seller';
      const limit = role === 'buyer' ? BUYER_LIMIT : SELLER_LIMIT;
      const myLastOffer = role === 'buyer' ? buyerLastOffer : sellerLastOffer;
      responsePacket = evaluateProposal('compromise', role, limit, myLastOffer, CONCESSION_STEP);
    }
    
    // Wire the State into the Simulator
    if (responsePacket.action === 'propose') {
      const strategy = responsePacket.payload.details?.strategy as any || 'compromise';
      const role = recipient.id === Agent_A.id ? 'buyer' : 'seller';
      const limit = role === 'buyer' ? BUYER_LIMIT : SELLER_LIMIT;
      const myLastOffer = role === 'buyer' ? buyerLastOffer : sellerLastOffer;
      
      const refinedPacket = evaluateProposal(strategy, role, limit, myLastOffer, CONCESSION_STEP);
      
      // Update state variables
      const rateMatch = refinedPacket.payload.message.match(/\$(\d+)/);
      if (rateMatch) {
        const newRate = parseInt(rateMatch[1], 10);
        if (role === 'buyer') buyerLastOffer = newRate;
        else sellerLastOffer = newRate;
      }
      
      responsePacket = refinedPacket;
    }

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
  payload: { 
    message: `I am offering my services for $${sellerLastOffer}. Are you interested?`,
    details: { strategy: 'hold_firm' }
  },
  reasoning: "Starting the negotiation at the initial offer price."
};

// Start the domino effect
routePacket(initialOffer);
