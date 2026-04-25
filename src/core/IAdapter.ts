export interface IAdapter {
  initialize(): Promise<void>;
  stop(): Promise<void>;
}
