import { IntentPacket } from '../router/schema.js';
import { logDecision } from '../memory/audit.js';

export async function evaluateProposal(
  strategy: 'compromise' | 'hold_firm' | 'walk_away',
  role: 'buyer' | 'seller',
  limit: number,
  myLastOffer: number,
  concessionStep: number
): Promise<IntentPacket> {
  let newOffer = myLastOffer;
  let message = '';
  let reasoning = `Strategy: ${strategy}. Role: ${role}. Limit: ${limit}. Last Offer: ${myLastOffer}.`;

  if (strategy === 'walk_away') {
    const packet: IntentPacket = {
      from: 'vadjanix://negotiator',
      to: 'opponent',
      action: 'refuse',
      payload: {
        message: "I cannot meet your terms. I am walking away from this negotiation."
      },
      reasoning: "Walk away strategy chosen."
    };

    await logDecision(
      'refuse',
      `Negotiation for ${role} (Limit: ${limit}, Last: ${myLastOffer})`,
      'Walk Away Protocol',
      'Terminated negotiation.'
    );

    return packet;
  }

  if (strategy === 'hold_firm') {
    newOffer = myLastOffer;
    message = `My offer remains $${newOffer}. [FINAL OFFER]`;
  } else if (strategy === 'compromise') {
    if (role === 'buyer') {
      newOffer = Math.min(myLastOffer + concessionStep, limit);
    } else {
      newOffer = Math.max(myLastOffer - concessionStep, limit);
    }

    if (newOffer === limit) {
      message = `I can offer $${newOffer}. [FINAL OFFER]`;
    } else {
      message = `I can offer $${newOffer}.`;
    }
  }

  // Safety Catch: If the newOffer equals the limit, automatically mutate the strategy to hold_firm
  const finalStrategy = newOffer === limit ? 'hold_firm' : strategy;
  if (newOffer === limit && !message.includes('[FINAL OFFER]')) {
    message += ' [FINAL OFFER]';
  }

  const packet: IntentPacket = {
    from: 'vadjanix://negotiator',
    to: 'opponent',
    action: 'propose',
    payload: {
      message: message,
      details: {
        strategy: finalStrategy
      }
    },
    reasoning: reasoning
  };

  await logDecision(
    'propose',
    `Counter-offer for ${role} (Last: ${myLastOffer}, Step: ${concessionStep})`,
    `${finalStrategy === 'hold_firm' ? 'Hard Ceiling/Floor Rule' : 'Monotonic Bidding Rule'}`,
    `Counter-offer of $${newOffer}`
  );

  return packet;
}
