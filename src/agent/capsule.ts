import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import * as ed from '@noble/ed25519';
import { SecureVault } from '../security/vault.js';

export interface StateCapsule {
  id: string;
  timestamp: number;
  action_description: string;
  predicted_changes: string[];
  memory_hashes: Record<string, string>;
  confidence: number;
  signature: string;
}

export class CapsuleManager {
  private readonly capsuleDir = './capsules';
  private readonly backupDir = './.capsule_backups';
  private readonly targetFiles = ['memory/vadjanix.db', 'soul/PRINCIPLES.json', 'GOALS.md'];
  private vault: SecureVault;

  constructor() {
    if (!fs.existsSync(this.capsuleDir)) {
      fs.mkdirSync(this.capsuleDir, { recursive: true });
    }
    if (!fs.existsSync(this.backupDir)) {
      fs.mkdirSync(this.backupDir, { recursive: true });
    }
    const masterPassword = process.env.MASTER_PASSWORD || 'default-password';
    this.vault = new SecureVault(masterPassword);
  }

  private async _getOrGenerateKeys(): Promise<{ privateKey: string; publicKey: string }> {
    try {
      const privateKey = this.vault.get('capsule_private_key');
      const publicKey = this.vault.get('capsule_public_key');
      return { privateKey, publicKey };
    } catch (e) {
      const privKey = crypto.randomBytes(32);
      const pubKey = await ed.getPublicKeyAsync(privKey);
      const privHex = Buffer.from(privKey).toString('hex');
      const pubHex = Buffer.from(pubKey).toString('hex');
      this.vault.set('capsule_private_key', privHex);
      this.vault.set('capsule_public_key', pubHex);
      return { privateKey: privHex, publicKey: pubHex };
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

  public async createCapsule(action: string, changes: string[], confidence: number): Promise<string> {
    const id = `cap_${Date.now()}`;
    const memory_hashes = await this._hashAndBackupState(id);
    const capsuleData: Omit<StateCapsule, 'signature'> = {
      id,
      timestamp: Date.now(),
      action_description: action,
      predicted_changes: changes,
      memory_hashes,
      confidence
    };

    const { privateKey } = await this._getOrGenerateKeys();
    const message = JSON.stringify(capsuleData);
    const msgHash = crypto.createHash('sha256').update(message).digest();
    const signature = await ed.signAsync(msgHash, Buffer.from(privateKey, 'hex'));
    const signatureHex = Buffer.from(signature).toString('hex');

    const fullCapsule: StateCapsule = { ...capsuleData, signature: signatureHex };
    fs.writeFileSync(path.join(this.capsuleDir, `${id}.json`), JSON.stringify(fullCapsule, null, 2));
    
    return id;
  }

  public async rollback(capsuleId?: string): Promise<{ success: boolean; restored: string }> {
    const files = fs.readdirSync(this.capsuleDir)
      .filter(f => f.endsWith('.json'))
      .sort((a, b) => {
        const statA = fs.statSync(path.join(this.capsuleDir, a));
        const statB = fs.statSync(path.join(this.capsuleDir, b));
        return statB.mtimeMs - statA.mtimeMs;
      });

    const capsules = files.map(f => {
      const content = fs.readFileSync(path.join(this.capsuleDir, f), 'utf-8');
      return JSON.parse(content) as StateCapsule;
    });

    let target: StateCapsule;
    if (capsuleId) {
      const found = capsules.find(c => c.id === capsuleId);
      if (!found) throw new Error(`Capsule ${capsuleId} not found`);
      target = found;
    } else {
      if (capsules.length < 2) throw new Error('No previous state available for rollback');
      target = capsules[1]; // second-to-last
    }

    // Verify signature
    const { publicKey } = await this._getOrGenerateKeys();
    const { signature, ...capsuleData } = target;
    const message = JSON.stringify(capsuleData);
    const msgHash = crypto.createHash('sha256').update(message).digest();
    const isValid = await ed.verifyAsync(Buffer.from(signature, 'hex'), msgHash, Buffer.from(publicKey, 'hex'));
    
    if (!isValid) throw new Error(`Invalid signature for capsule ${target.id}`);

    // Restore state
    for (const [filename, expectedHash] of Object.entries(target.memory_hashes)) {
      const backupName = filename.replace(/\//g, '_').replace(/\\/g, '_');
      const backupPath = path.join(this.backupDir, `${target.id}_${backupName}`);
      if (!fs.existsSync(backupPath)) continue;
      
      const content = fs.readFileSync(backupPath);
      const actualHash = crypto.createHash('sha256').update(content).digest('hex');
      if (actualHash !== expectedHash) {
        throw new Error(`Hash mismatch for ${filename} in capsule ${target.id}`);
      }
      fs.copyFileSync(backupPath, filename);
    }

    return { success: true, restored: target.action_description };
  }

  public buildSemanticDiff(changes: string[], confidence: number, reversible: boolean): string {
    const list = changes.map(c => `  • ${c}`).join('\n');
    return `📋 PROPOSED CHANGES\n${list}\nConfidence: ${confidence}% | Reversible: ${reversible ? 'Yes' : 'No'}`;
  }

  public async verifyChain(): Promise<boolean> {
    const files = fs.readdirSync(this.capsuleDir).filter(f => f.endsWith('.json'));
    const capsules = files.map(f => {
      const content = fs.readFileSync(path.join(this.capsuleDir, f), 'utf-8');
      return JSON.parse(content) as StateCapsule;
    }).sort((a, b) => a.timestamp - b.timestamp); // chronological by data

    const { publicKey } = await this._getOrGenerateKeys();
    const pubKeyBuf = Buffer.from(publicKey, 'hex');

    for (const capsule of capsules) {
      const { signature, ...data } = capsule;
      const message = JSON.stringify(data);
      const msgHash = crypto.createHash('sha256').update(message).digest();
      const isValid = await ed.verifyAsync(Buffer.from(signature, 'hex'), msgHash, pubKeyBuf);
      if (!isValid) return false;
    }

    return true;
  }
}
