import assert from 'node:assert';
import { parseTelegramUpdate, sendTelegramMessage } from '../src/router/telegram.js';
import { routePacket } from '../src/router/index.js';
import { IntentPacket } from '../src/router/schema.js';

async function main() {
  console.log("🚀 Starting Telegram Adapter Validation Tests...");
  let failureCount = 0;

  // Mock environment
  process.env.TELEGRAM_BOT_TOKEN = 'mock_token';

  async function runTest(name: string, fn: () => Promise<void>) {
    try {
      await fn();
      console.log(`[PASS] ${name}`);
    } catch (e: any) {
      console.error(`[FAIL] ${name}: ${e.message}`);
      failureCount++;
    }
  }

  // 1. Test parseTelegramUpdate (Success)
  await runTest("parseTelegramUpdate: Valid Text Message", async () => {
    const mockUpdate = {
      message: {
        chat: { id: 12345 },
        text: "Hello Vadjanix"
      }
    };
    const packet = parseTelegramUpdate(mockUpdate);
    assert.ok(packet, "Packet should be parsed");
    assert.strictEqual(packet.from, "telegram://12345");
    assert.strictEqual(packet.payload.message, "Hello Vadjanix");
    assert.strictEqual(packet.action, "write");
  });

  // 2. Test parseTelegramUpdate (Non-text)
  await runTest("parseTelegramUpdate: Non-text Message", async () => {
    const mockUpdate = {
      message: {
        chat: { id: 12345 },
        photo: []
      }
    };
    const packet = parseTelegramUpdate(mockUpdate);
    assert.strictEqual(packet, null, "Packet should be null for non-text updates");
  });

  // 3. Test sendTelegramMessage (Success)
  await runTest("sendTelegramMessage: Success", async () => {
    const globalFetch = global.fetch;
    global.fetch = async (url: any, options: any) => {
      assert.strictEqual(url, "https://api.telegram.org/botmock_token/sendMessage");
      const body = JSON.parse(options.body);
      assert.strictEqual(body.chat_id, "12345");
      assert.strictEqual(body.text, "Hello User");
      return {
        ok: true,
        json: async () => ({ ok: true, result: { message_id: 1 } })
      } as any;
    };

    try {
      const result = await sendTelegramMessage("12345", "Hello User", "mock_token");
      assert.strictEqual(result.ok, true);
    } finally {
      global.fetch = globalFetch;
    }
  });

  // 4. Test Router: Telegram Protocol
  await runTest("Router: telegram: protocol routing", async () => {
    const globalFetch = global.fetch;
    let fetchCalled = false;
    global.fetch = async (url: any, options: any) => {
      fetchCalled = true;
      return {
        ok: true,
        json: async () => ({ ok: true })
      } as any;
    };

    try {
      const packet: IntentPacket = {
        from: "vadjanix://brain",
        to: "telegram://54321",
        action: "write",
        payload: { message: "Route this to Telegram" },
        reasoning: "Protocol test"
      };
      const result = await routePacket(packet);
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.status, 200);
      assert.ok(fetchCalled, "fetch should have been called to send telegram message");
    } finally {
      global.fetch = globalFetch;
    }
  });

  // 5. Test Router: Telegram Missing Token
  await runTest("Router: telegram: protocol fails without token", async () => {
    const oldToken = process.env.TELEGRAM_BOT_TOKEN;
    delete process.env.TELEGRAM_BOT_TOKEN;

    try {
      const packet: IntentPacket = {
        from: "vadjanix://brain",
        to: "telegram://54321",
        action: "write",
        payload: { message: "Should fail" },
        reasoning: "Missing token test"
      };
      const result = await routePacket(packet);
      assert.strictEqual(result.success, false);
      assert.strictEqual(result.status, 500);
      assert.ok(result.error?.includes("Telegram Bot Token not configured"));
    } finally {
      process.env.TELEGRAM_BOT_TOKEN = oldToken;
    }
  });

  if (failureCount > 0) {
    console.error(`\n❌ Telegram validation suite failed with ${failureCount} errors.`);
    process.exit(1);
  } else {
    console.log("\n✅ All Telegram Validation Tests Passed!");
    process.exit(0);
  }
}

main().catch(e => {
  console.error("Critical Test Runner Failure:", e);
  process.exit(1);
});
