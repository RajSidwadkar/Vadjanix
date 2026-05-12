import { Client, GatewayIntentBits, Events, Message, ChannelType } from 'discord.js';
import { ChannelAdapter, InboundMessage } from './types.js';

export class DiscordAdapter implements ChannelAdapter {
  private client: Client;
  private messageHandler?: (msg: InboundMessage) => Promise<void>;
  private connected = false;

  constructor() {
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
    if (!token) throw new Error('DISCORD_BOT_TOKEN missing');

    this.client.once(Events.ClientReady, (readyClient) => {
      console.log(`[DISCORD] Bot is online as ${readyClient.user.tag}`);
      this.connected = true;
    });

    this.client.on(Events.MessageCreate, async (message: Message) => {
      if (message.author.bot) return;
      
      const botId = this.client.user?.id || '';
      const isDM = message.channel.type === ChannelType.DM;
      const isMentioned = message.mentions.has(botId);
      
      if (!isDM && !isMentioned) return;

      const cleanContent = message.content.replace(new RegExp(`<@!?${botId}>`, 'g'), '').trim();

      if (this.messageHandler) {
        await this.messageHandler({
          channel: 'discord',
          from: message.author.id,
          content: cleanContent,
          timestamp: message.createdTimestamp,
          raw: message
        });
      }
    });

    await this.client.login(token);
  }

  public async send(to: string, message: string): Promise<void> {
    const channel = await this.client.users.fetch(to);
    if (channel) {
      await channel.send(message);
    }
  }

  public onMessage(handler: (msg: InboundMessage) => Promise<void>): void {
    this.messageHandler = handler;
  }

  public isConnected(): boolean {
    return this.connected;
  }

  public async stop(): Promise<void> {
    await this.client.destroy();
    this.connected = false;
  }
}
