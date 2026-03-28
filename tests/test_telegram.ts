import { parseTelegramUpdate, sendTelegramMessage } from '../src/adapters/telegram.js';
import { IntentPacket } from '../src/router/schema.js';

// Mock process.env
process.env.TELEGRAM_BOT_TOKEN = 'mock_token';

async function testTelegramAdapter() {
  console.log('--- Testing Telegram Adapter ---');

  // 1. Test parseTelegramUpdate
  const mockUpdate = {
    update_id: 12345,
    message: {
      message_id: 1,
      from: { id: 123, is_bot: false, first_name: 'Test', username: 'testuser' },
      chat: { id: 123, first_name: 'Test', type: 'private' },
      date: 1614552000,
      text: 'Hello Vadjanix!'
    }
  };

  const packet = parseTelegramUpdate(mockUpdate);
  if (packet && packet.from === 'telegram://123' && packet.payload.message === 'Hello Vadjanix!') {
    console.log('✅ parseTelegramUpdate: PASS');
  } else {
    console.error('❌ parseTelegramUpdate: FAIL', packet);
  }

  const nonTextUpdate = {
    update_id: 12346,
    message: {
      message_id: 2,
      chat: { id: 123 },
      photo: []
    }
  };
  const nullPacket = parseTelegramUpdate(nonTextUpdate);
  if (nullPacket === null) {
    console.log('✅ parseTelegramUpdate (non-text): PASS');
  } else {
    console.error('❌ parseTelegramUpdate (non-text): FAIL');
  }

  // 2. Test sendTelegramMessage (mock fetch)
  const globalFetch = global.fetch;
  global.fetch = async (url: any, options: any) => {
    console.log(`[MOCK FETCH] URL: ${url}`);
    console.log(`[MOCK FETCH] Body: ${options.body}`);
    return {
      ok: true,
      json: async () => ({ ok: true, result: { message_id: 999 } })
    } as any;
  };

  try {
    await sendTelegramMessage('123', 'Response from Brain', 'mock_token');
    console.log('✅ sendTelegramMessage: PASS');
  } catch (e: any) {
    console.error('❌ sendTelegramMessage: FAIL', e.message);
  } finally {
    global.fetch = globalFetch;
  }
}

testTelegramAdapter().catch(console.error);
