import { IAdapter } from '../../core/IAdapter.js';
import { VadjanixAgent } from '../../core/agent.js';

export class TelegramAdapter implements IAdapter {
  private abortController: AbortController | null = null;

  constructor(private agent: VadjanixAgent) {}

  public async initialize(): Promise<void> {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) {
      console.error('[TELEGRAM - FATAL] TELEGRAM_BOT_TOKEN is missing in .env');
      return;
    }

    console.log('[TELEGRAM] Long-polling engine initialized. Connecting to Telegram servers...');
    
    this.startPolling(botToken);
  }

  public async stop(): Promise<void> {
    console.log('[TELEGRAM] Halting polling engine...');
    this.abortController?.abort();
  }

  private async startPolling(botToken: string): Promise<void> {
    let offset = 0;
    this.abortController = new AbortController();

    while (true) {
      try {
        const url = `https://api.telegram.org/bot${botToken}/getUpdates?offset=${offset}&timeout=30`;
        const response = await fetch(url, { signal: this.abortController.signal });
        
        if (!response.ok) {
           console.error(`[TELEGRAM] API Error: ${response.statusText}`);
           await new Promise(res => setTimeout(res, 5000));
           continue;
        }

        const data = await response.json() as any;

        if (data.ok && data.result.length > 0) {
          for (const update of data.result) {
            offset = update.update_id + 1;

            if (update.message && update.message.text) {
              const chatId = update.message.chat.id;
              const text = update.message.text;

              console.log(`\n[INCOMING - TELEGRAM] Received message from ${chatId}`);
              
              try {
                const aiResponse = await this.agent.handleIncomingMessage('telegram', chatId.toString(), text);
                if (aiResponse) {
                  await this.sendMessage(chatId, aiResponse, botToken);
                }
              } catch (err: any) {
                console.error('[TELEGRAM] Brain routing failed:', err.message);
              }
            }
          }
        }
      } catch (error: any) {
        if (error.name === 'AbortError') {
          console.log('[TELEGRAM] Polling cleanly aborted.');
          break;
        }
        console.error('[TELEGRAM] Polling connection error:', error.message);
        await new Promise(res => setTimeout(res, 5000));
      }
    }
  }

  private async sendMessage(chatId: string | number, text: string, botToken: string) {
    console.log(`[OUTPUT - TELEGRAM] Sending: "${text.substring(0, 50)}..."`);
    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: text })
    });
    
    if (!response.ok) {
      console.error(`[OUTPUT - FATAL] Failed to send: ${response.statusText}`);
    } else {
      console.log(`[OUTPUT - TELEGRAM] ✅ Sent successfully.`);
    }
  }
}