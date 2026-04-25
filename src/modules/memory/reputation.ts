import fs from 'fs/promises';
import path from 'path';
import { NostrAdapter } from '../../infrastructure/adapters/nostr.js';
import { IntentPacket } from '../../router/schema.js';

export async function calculateReputation(pubkey: string): Promise<number> {
  const dealsPath = path.join(process.cwd(), 'memory', 'deals.md');
  try {
    const data = await fs.readFile(dealsPath, 'utf-8');
    const lines = data.split('\n').filter(line => line.trim() !== '');
    
    let totalDeals = 0;
    let successfulDeals = 0;

    for (const line of lines) {
      try {
        const deal = JSON.parse(line);
        if (deal.counterparty === pubkey) {
          totalDeals++;
          if (deal.status === 'success') {
            successfulDeals++;
          }
        }
      } catch (e) {
      }
    }

    if (totalDeals === 0) {
      console.warn(`[REPUTATION] No deals found for ${pubkey}, returning neutral score 50.`);
      return 50;
    }

    const score = (successfulDeals / totalDeals) * 100;
    return score;
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      console.warn(`[REPUTATION] deals.md not found, returning neutral score 50.`);
      return 50;
    }
    console.error(`[REPUTATION] Error reading deals.md: ${error.message}`);
    return 50;
  }
}

export async function broadcastTrustScore(pubkey: string): Promise<boolean> {
  const score = await calculateReputation(pubkey);
  
  const packet: IntentPacket = {
    from: 'vadjanix://brain',
    to: `vadjanix://${pubkey}`,
    action: 'write',
    payload: {
      message: `Reputation Attestation: Trust Score for ${pubkey} is ${score.toFixed(2)}%`,
      details: {
        task_name: 'reputation_attestation',
        parameters: {
          target_pubkey: pubkey,
          trust_score: score
        }
      }
    },
    reasoning: `Public reputation attestation based on local deal history for ${pubkey}.`
  };

  console.log(`[REPUTATION] Broadcasting trust score for ${pubkey}: ${score.toFixed(2)}%`);
  return await NostrAdapter.nostrSend(packet);
}
