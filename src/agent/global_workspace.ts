export interface WorkspaceState {
  currentIntent: string;
  activeGoal: string;
  affectiveState: {
    confidence: number;
    urgency: number;
    trust: number;
    novelty: number;
  };
  recentCorrections: string[];
  pendingMcqCount: number;
  paused: boolean;
}

export type WorkspaceHandler = (update: Partial<WorkspaceState>) => void;

export class GlobalWorkspace {
  private static instance: GlobalWorkspace;
  private state: WorkspaceState = {
    currentIntent: '',
    activeGoal: '',
    affectiveState: {
      confidence: 1.0,
      urgency: 0.0,
      trust: 1.0,
      novelty: 0.0
    },
    recentCorrections: [],
    pendingMcqCount: 0,
    paused: false
  };
  private subscribers: Map<string, WorkspaceHandler> = new Map();

  private constructor() {}

  public static getInstance(): GlobalWorkspace {
    if (!GlobalWorkspace.instance) {
      GlobalWorkspace.instance = new GlobalWorkspace();
    }
    return GlobalWorkspace.instance;
  }

  broadcast(update: Partial<WorkspaceState>): void {
    this.state = { ...this.state, ...update };
    for (const handler of this.subscribers.values()) {
      handler(update);
    }
  }

  subscribe(module: string, handler: WorkspaceHandler): void {
    this.subscribers.set(module, handler);
  }

  getContext(): WorkspaceState {
    return { ...this.state };
  }
}
