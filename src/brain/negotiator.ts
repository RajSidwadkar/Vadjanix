import { IntentPacket } from '../router/schema.js';

export function evaluateProposal(
  strategy: 'compromise' | 'hold_firm' | 'walk_away',
  role: 'buyer' | 'seller',
  limit: number,
  myLastOffer: number,
  concessionStep: number
): IntentPacket {
  let newOffer = myLastOffer;
  let message = '';
  let reasoning = `Strategy: ${strategy}. Role: ${role}. Limit: ${limit}. Last Offer: ${myLastOffer}.`;

  if (strategy === 'walk_away') {
    return {
      from: 'vadjanix://negotiator',
      to: 'opponent',
      action: 'refuse',
      payload: {
        message: "I cannot meet your terms. I am walking away from this negotiation."
      },
      reasoning: "Walk away strategy chosen."
    };
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

  return {
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
}
