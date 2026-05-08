import { LLMAdapter } from '../core/llm_adapter.js';
import { SecureVault } from '../security/vault.js';

export class ClaudeAdapter implements LLMAdapter {
  public name = 'claude';
  private model = 'claude-sonnet-4-6';

  private getApiKey(): string {
    const vault = new SecureVault(process.env.MASTER_PASSWORD || 'default-password');
    return vault.get('CLAUDE_KEY');
  }

  async reason(prompt: string, context?: object): Promise<{ text: string, confidence: number }> {
    const apiKey = this.getApiKey();
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: this.model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 1024,
        ...context
      })
    });

    if (!response.ok) {
      throw new Error(`Claude Error: ${response.statusText}`);
    }

    const data = await response.json() as any;
    const text = data.content[0].text;
    
    return {
      text,
      confidence: 0.94
    };
  }

  async isAvailable(): Promise<boolean> {
    try {
      const apiKey = this.getApiKey();
      return !!apiKey;
    } catch {
      return false;
    }
  }
}
