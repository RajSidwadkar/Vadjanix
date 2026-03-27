import { IntentPacket } from './schema.js';

export function parseTelegramUpdate(body: any): IntentPacket | null {
  if (body?.message?.text && body?.message?.chat?.id) {
    return {
      from: `telegram://${body.message.chat.id}`,
      to: 'vadjanix://brain',
      action: 'write',
      payload: {
        message: body.message.text
      },
      reasoning: 'Telegram incoming message'
    };
  }
  return null;
}

export async function sendTelegramMessage(chatId: string, text: string, botToken: string) {
  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      chat_id: chatId,
      text: text
    })
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(`Telegram API error: ${JSON.stringify(errorData)}`);
  }

  return response.json();
}
