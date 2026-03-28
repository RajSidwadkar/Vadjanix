import { Client, GatewayIntentBits, Events, ChannelType, Message } from 'discord.js';
import 'dotenv/config';
import { processIncomingPacket } from '../brain/engine.js';
import { initializeSwarm, processWithSwarm } from '../brain/SwarmManager.js';
import { IntentPacket } from '../router/schema.js';

/**
 * Initializes the Discord bot client and event listeners.
 */
export async function initializeDiscordBot() {
  const token = process.env.DISCORD_BOT_TOKEN;
  if (!token) {
    console.error('[DISCORD] Missing DISCORD_BOT_TOKEN in .env');
    return;
  }

  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
      GatewayIntentBits.DirectMessages,
    ],
  });

  client.once(Events.ClientReady, (readyClient: Client<true>) => {
    console.log(`[DISCORD] Bot is online! Logged in as ${readyClient.user.tag}`);
  });

  client.on(Events.MessageCreate, async (message: Message) => {
    // 1. CRITICAL SECURITY: Ignore messages from bots to prevent loops
    if (message.author.bot) return;

    // 2. FILTER: Respond only if mentioned OR if it's a DM
    const isDM = message.channel.type === ChannelType.DM;
    const isMentioned = client.user ? message.mentions.has(client.user.id) : false;

    if (!isDM && !isMentioned) return;

    // 3. UX: Trigger typing indicator
    try {
      await message.channel.sendTyping();
    } catch (e) {
      console.warn('[DISCORD] Failed to send typing indicator:', e);
    }

    // 4. ROUTING: Clean content and send to Swarm
    const botId = client.user?.id || '';
    const mentionRegex = new RegExp(`<@!?${botId}>`, 'g');
    const cleanContent = message.content.replace(mentionRegex, '').trim();

    const sessionId = `discord-${message.author.id}`;

    try {
      // Process through the Swarm
      const llmResponse = await processWithSwarm(cleanContent || "Hello", sessionId);

      // 5. RESPONSE: Reply to user
      if (llmResponse.text) {
        await message.reply(llmResponse.text);
      }
    } catch (error: any) {
      console.error('[DISCORD] Swarm processing failed:', error.message);
      await message.reply("⚠️ Sorry, my Brain is having some trouble processing that right now.");
    }
  });

  try {
    await client.login(token);
  } catch (error: any) {
    console.error('[DISCORD] Login failed:', error.message);
  }
}
