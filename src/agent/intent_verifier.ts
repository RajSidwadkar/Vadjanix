import { LLMAdapter } from '../core/llm_adapter.js';
import { MCQStore } from './mcq_store.js';
import { MCQPacket } from '../core/mcq_schema.js';

export interface VerificationResult {
  matches: boolean;
  concern?: string;
  mcqId?: string;
}

export class IntentVerifier {
  private mcqStore = new MCQStore();

  constructor(private adapter: LLMAdapter) {}

  /**
   * Independent LLM call — FRESH context, no shared state with producing agent
   */
  async verify(originalRequest: string, proposedAction: string): Promise<VerificationResult> {
    const systemPrompt = 'You are a security checker. Answer only YES or NO.';
    const userPrompt = `Original request: ${originalRequest}\nProposed action: ${proposedAction}\nDoes the action match? YES or NO + brief reason`;
    
    const fullPrompt = `${systemPrompt}\n\n${userPrompt}`;
    
    try {
      const response = await this.adapter.reason(fullPrompt);
      const text = response.text.trim();

      if (text.toUpperCase().startsWith('YES')) {
        return { matches: true };
      } else {
        // Parse "NO + brief reason"
        const lines = text.split('\n');
        let concern = lines[0];
        if (concern.toUpperCase().startsWith('NO')) {
          concern = concern.substring(2).replace(/^[.:-\s]+/, '').trim();
        }
        
        if (!concern && lines.length > 1) {
          concern = lines[1].trim();
        }

        const finalConcern = concern || 'Action does not match request';

        // Requirement: If matches=false -> pause execution, surface to owner as MCQ
        // We create a "Security Verification" MCQ that blocks execution until resolved.
        const mcqPacket: MCQPacket = {
          level: 'L1', // Highest intervention required
          question: `⚠️ SECURITY ALERT: Proposed action may not match your request.\n\nRequest: "${originalRequest}"\nProposed: "${proposedAction}"\n\nConcern: ${finalConcern}\n\nShould I proceed?`,
          options: {
            'A': 'Yes, proceed anyway',
            'B': 'No, cancel this action',
            'C': 'Explain further'
          },
          semantic_diff: `User: ${originalRequest} vs Agent: ${proposedAction}`,
          confidence: response.confidence,
          risk: 'High',
          reversible: false,
          timeout_mins: 60
        };

        const mcqId = this.mcqStore.add(mcqPacket);

        return { 
          matches: false, 
          concern: finalConcern,
          mcqId
        };
      }
    } catch (error: any) {
      return { 
        matches: false, 
        concern: `Verification failed: ${error.message}` 
      };
    }
  }
}
