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

      console.log(`[DISCORD] Received message from ${message.author.id}: ${message.content}`);
      console.log('[ADAPTER] Agent exists?', !!this.agent);
      console.log('[ADAPTER] Routing to Brain...');

      try {
        if ('sendTyping' in message.channel) {
          await message.channel.sendTyping();
        }
      } catch (e) {}

      const botId = this.client.user?.id || '';
      const mentionRegex = new RegExp(`<@!?${botId}>`, 'g');
      const cleanContent = message.content.replace(mentionRegex, '').trim();

      try {
        const response = await this.agent.handleIncomingMessage('discord', message.author.id, cleanContent || "Hello");
        if (response) {
          await message.reply(response);
        }
      } catch (error: any) {
        console.error('[DISCORD ERROR]', error);
        await message.reply("⚠️ Sorry, my Brain is having some trouble processing that.");
      }
    });

    await this.client.login(token);
  }
}
