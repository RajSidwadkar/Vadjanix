export interface VadjanixAgent {
  processEventQueue(): Promise<void>;
  checkGoalsProgress(): Promise<void>;
  runAutonomousActions(): Promise<void>;
  sendWhatsApp(message: string): Promise<void>;
}
