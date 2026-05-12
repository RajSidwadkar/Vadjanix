export interface InboundMessage {
  channel: string;
  from: string;
  content: string;
  timestamp: number;
  raw?: any;
}

export interface ChannelAdapter {
  send(to: string, message: string): Promise<void>;
  onMessage(handler: (msg: InboundMessage) => Promise<void>): void;
  isConnected(): boolean;
  initialize(): Promise<void>;
  stop(): Promise<void>;
}

export interface SessionState {
  counterpartyId: string;
  lastChannel: string;
  lastInteraction: number;
  context: Record<string, any>;
}
