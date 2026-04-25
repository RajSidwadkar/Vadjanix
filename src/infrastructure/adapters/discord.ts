import { Client, GatewayIntentBits, Events, Message, ChannelType } from 'discord.js';
import { IAdapter } from '../../core/IAdapter.js';
import { VadjanixAgent } from '../../core/agent.js';

export class DiscordAdapter implements IAdapter {
  private client: Client;

  constructor(private agent: VadjanixAgent) {
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages,
      ],
    });
  }

  public async initialize(): Promise<void> {
    const token = process.env.DISCORD_BOT_TOKEN;
    if (!token) return;

    this.client.once(Events.ClientReady, (readyClient: Client<true>) => {
      console.log(`[DISCORD] Bot is online as ${readyClient.user.tag}`);
    });

    this.client.on(Events.MessageCreate, async (message: Message) => {
      if (message.author.bot) return;
      const isDM = message.channel.type === ChannelType.DM;
      const isMentioned = this.client.user ? message.mentions.has(this.client.user.id) : false;
      if (!isDM && !isMentioned) return;

      const botId = this.client.user?.id || '';
      const mentionRegex = new RegExp(`<@!?${botId}>`, 'g');
      const cleanContent = message.content.replace(mentionRegex, '').trim();

      try {
        if ('sendTyping' in message.channel) {
          await message.channel.sendTyping();
        }
      } catch (e) {}

      try {
        const response = await this.agent.handleIncomingMessage('discord', message.author.id, cleanContent || "Hello");
        if (response) {
          console.log(`[OUTPUT - DISCORD] Attempting to send: "${response.substring(0, 50)}..."`);
          try {
            await message.reply(response);
            console.log(`[OUTPUT - DISCORD] ✅ Message sent successfully.`);
          } catch (err: any) {
            console.error(`[OUTPUT - FATAL] Failed to send via API:`, err.message || err);
          }
        }
      } catch (error: any) {
        console.error('[DISCORD ERROR]', error);
        try {
          await message.reply("⚠️ Sorry, my Brain is having some trouble processing that.");
        } catch (err: any) {
          console.error(`[OUTPUT - FATAL] Failed to send error message:`, err.message || err);
        }
      }
    });

    await this.client.login(token);
  }

  public async stop(): Promise<void> {
    console.log('[DISCORD] Disconnecting bot...');
    await this.client.destroy();
  }
}
