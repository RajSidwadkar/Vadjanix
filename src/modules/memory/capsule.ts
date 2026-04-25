import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export interface StateCapsule {
  id: string;
  timestamp: number;
  action_description: string;
  predicted_changes: string[];
  memory_hashes: Record<string, string>;
  confidence: number;
  signature: string;
}

export class SovereigntyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SovereigntyError';
  }
}

export class CapsuleManager {
  private readonly capsuleDir = './capsules';
  private readonly backupDir = './.capsule_backups';
  private readonly targetFiles = ['memory/vadjanix.db', 'soul/PRINCIPLES.json', 'GOALS.md'];

  constructor() {
    if (!fs.existsSync(this.capsuleDir)) {
      fs.mkdirSync(this.capsuleDir, { recursive: true });
    }
    if (!fs.existsSync(this.backupDir)) {
      fs.mkdirSync(this.backupDir, { recursive: true });
    }
  }

  private async _hashAndBackupState(capsuleId: string): Promise<Record<string, string>> {
    const hashes: Record<string, string> = {};
    for (const filename of this.targetFiles) {
      if (fs.existsSync(filename)) {
        const content = fs.readFileSync(filename);
        const hash = crypto.createHash('sha256').update(content).digest('hex');
        hashes[filename] = hash;
        const backupName = filename.replace(/\//g, '_').replace(/\\/g, '_');
        fs.copyFileSync(filename, path.join(this.backupDir, `${capsuleId}_${backupName}`));
      }
    }
    return hashes;
  }

  private _signCapsule(data: string): string {
    const privKeyHex = process.env.NOSTR_PRIVKEY;
    if (!privKeyHex) {
      throw new SovereigntyError('NOSTR_PRIVKEY is missing');
    }
    const privKey = Buffer.from(privKeyHex, 'hex');
    const pkcs8 = Buffer.concat([
      Buffer.from('302e020100300506032b657004220420', 'hex'),
      privKey
    ]);
    const key = crypto.createPrivateKey({
      key: pkcs8,
      format: 'der',
      type: 'pkcs8'
    });
    return crypto.sign(null, Buffer.from(data), key).toString('hex');
  }

  public async createCapsule(action_description: string, predicted_changes: string[], confidence: number): Promise<StateCapsule> {
    const id = `cap_${Date.now()}`;
    const memory_hashes = await this._hashAndBackupState(id);
    const capsule: Omit<StateCapsule, 'signature'> = {
      id,
      timestamp: Date.now(),
      action_description,
      predicted_changes,
      memory_hashes,
      confidence
    };
    const signature = this._signCapsule(JSON.stringify(capsule));
    const fullCapsule: StateCapsule = { ...capsule, signature };
    fs.writeFileSync(path.join(this.capsuleDir, `${id}.json`), JSON.stringify(fullCapsule, null, 2));
    return fullCapsule;
  }

  private async _restoreState(capsuleId: string, memory_hashes: Record<string, string>): Promise<void> {
    for (const [filename, expectedHash] of Object.entries(memory_hashes)) {
      if (!this.targetFiles.includes(filename)) continue;
      const backupName = filename.replace(/\//g, '_').replace(/\\/g, '_');
      const backupPath = path.join(this.backupDir, `${capsuleId}_${backupName}`);
      if (!fs.existsSync(backupPath)) continue;
      const content = fs.readFileSync(backupPath);
      const actualHash = crypto.createHash('sha256').update(content).digest('hex');
      if (actualHash !== expectedHash) {
        throw new Error(`Hash mismatch for ${filename}`);
      }
      fs.copyFileSync(backupPath, filename);
    }
  }

  public async rollback(capsuleId?: string): Promise<{ success: boolean; restored: string }> {
    const files = fs.readdirSync(this.capsuleDir).filter(f => f.endsWith('.json'));
    const capsules = files.map(f => {
      const content = fs.readFileSync(path.join(this.capsuleDir, f), 'utf-8');
      return JSON.parse(content) as StateCapsule;
    }).sort((a, b) => b.timestamp - a.timestamp);

    let target: StateCapsule;
    if (capsuleId) {
      const found = capsules.find(c => c.id === capsuleId);
      if (!found) throw new Error(`Capsule ${capsuleId} not found`);
      target = found;
    } else {
      if (capsules.length < 2) throw new Error('No previous state available for rollback');
      target = capsules[1];
    }

    await this._restoreState(target.id, target.memory_hashes);
    return { success: true, restored: target.action_description };
  }

  public buildSemanticDiff(changes: string[], confidence: number, reversible: boolean): string {
    const list = changes.map(c => `  • ${c}`).join('\n');
    return `📋 PROPOSED CHANGES — Review before execution\n${list}\n\nConfidence: ${confidence}%  |  Reversible: ${reversible ? 'Yes' : 'No'}`;
  }
}
