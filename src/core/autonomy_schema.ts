import { AgentSelfModel } from './self_model.js';

export interface VadjanixAgent {
  processEventQueue(): Promise<void>;
  checkGoalsProgress(): Promise<void>;
  runAutonomousActions(): Promise<void>;
  sendWhatsApp(message: string): Promise<void>;
  getSelfModel(): AgentSelfModel;
  registerOutputChannel(name: string, sender: (msg: string) => Promise<void>): void;
  handleIncomingMessage(platform: string, userId: string, message: string): Promise<string>;
}
