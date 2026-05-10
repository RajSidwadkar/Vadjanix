import fs from 'node:fs';
import path from 'node:path';
import { MCQPacket } from '../core/mcq_schema.js';

export interface PendingMCQ {
  id: string;
  packet: MCQPacket;
  timestamp: number;
}

export class MCQStore {
  private readonly storePath = path.join(process.cwd(), 'pending_mcqs.json');

  constructor() {
    if (!fs.existsSync(this.storePath)) {
      fs.writeFileSync(this.storePath, '[]', 'utf-8');
    }
  }

  public add(packet: MCQPacket): string {
    const id = `mcq_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const pending: PendingMCQ = { id, packet, timestamp: Date.now() };
    const all = this.getAll();
    all.push(pending);
    this.save(all);
    return id;
  }

  public getAll(): PendingMCQ[] {
    try {
      const content = fs.readFileSync(this.storePath, 'utf-8');
      return JSON.parse(content);
    } catch (e) {
      return [];
    }
  }

  public remove(id: string): void {
    const all = this.getAll().filter(m => m.id !== id);
    this.save(all);
  }

  private save(mcqs: PendingMCQ[]): void {
    fs.writeFileSync(this.storePath, JSON.stringify(mcqs, null, 2), 'utf-8');
  }
}
