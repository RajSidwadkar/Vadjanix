import express from 'express';
import { IAdapter } from '../../core/IAdapter.js';
import { VadjanixAgent } from '../../core/agent.js';

export class TelegramAdapter implements IAdapter {
  constructor(private app: express.Application, private agent: VadjanixAgent) {}

  public async initialize(): Promise<void> {
    this.app.post('/webhook', async (req, res) => {
      res.sendStatus(200);
      const body = req.body;
      if (body?.message?.text && body?.message?.chat?.id) {
        const chatId = body.message.chat.id;
        const text = body.message.text;
        const botToken = process.env.TELEGRAM_BOT_TOKEN;
        if (!botToken) return;

        console.log(`[TELEGRAM] Received message from ${chatId}: ${text}`);
        console.log('[ADAPTER] Agent exists?', !!this.agent);
        console.log('[ADAPTER] Routing to Brain...');

        try {
          const response = await this.agent.handleIncomingMessage('telegram', chatId.toString(), text);
          if (response) {
            await this.sendMessage(chatId, response, botToken);
          }
        } catch (error: any) {
          console.error('[TELEGRAM ERROR]', error);
          await this.sendMessage(chatId, "System Error: Brain processing failed.", botToken);
        }
      }
    });
  }

  private async sendMessage(chatId: string | number, text: string, botToken: string) {
    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: text })
    });
  }
}
