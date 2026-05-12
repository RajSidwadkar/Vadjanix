import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { promisify } from 'node:util';
import { SecureVault } from '../security/vault.js';
import Database from 'better-sqlite3';

const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);

export class SnapshotManager {
  private readonly rootFiles = [
    'soul/PRINCIPLES.json',
    'GOALS.md',
    'narrative.md',
    'PRINCIPLES.md'
  ];

  private readonly dbPath = 'memory/vadjanix.db';
  private readonly capsulesDir = 'capsules';

  private getAllFiles(): string[] {
    const files: string[] = [];
    
    for (const f of this.rootFiles) {
      if (fs.existsSync(f)) files.push(f);
    }
    
    if (fs.existsSync(this.dbPath)) {
      files.push(this.dbPath);
    }
    
    if (fs.existsSync(this.capsulesDir)) {
      try {
        const capsuleFiles = fs.readdirSync(this.capsulesDir)
          .filter(f => f.endsWith('.json'))
          .map(f => path.join(this.capsulesDir, f));
        files.push(...capsuleFiles);
      } catch (e) {
        // capsules dir might not exist or be empty
      }
    }
    
    return files;
  }

  private pack(files: { path: string, data: Buffer }[]): Buffer {
    const buffers: Buffer[] = [];
    const header = Buffer.alloc(4);
    header.writeUInt32BE(files.length, 0);
    buffers.push(header);

    for (const file of files) {
      const pathBuf = Buffer.from(file.path, 'utf8');
      const pathLen = Buffer.alloc(4);
      pathLen.writeUInt32BE(pathBuf.length, 0);
      buffers.push(pathLen, pathBuf);

      const dataLen = Buffer.alloc(4);
      dataLen.writeUInt32BE(file.data.length, 0);
      buffers.push(dataLen, file.data);
    }

    return Buffer.concat(buffers);
  }

  private unpack(buffer: Buffer): { path: string, data: Buffer }[] {
    const files: { path: string, data: Buffer }[] = [];
    let offset = 0;

    if (buffer.length < 4) throw new Error('Buffer too small to unpack');
    const numFiles = buffer.readUInt32BE(offset);
    offset += 4;

    for (let i = 0; i < numFiles; i++) {
      if (offset + 4 > buffer.length) break;
      const pathLen = buffer.readUInt32BE(offset);
      offset += 4;
      
      if (offset + pathLen > buffer.length) break;
      const pathStr = buffer.toString('utf8', offset, offset + pathLen);
      offset += pathLen;

      if (offset + 4 > buffer.length) break;
      const dataLen = buffer.readUInt32BE(offset);
      offset += 4;
      
      if (offset + dataLen > buffer.length) break;
      const data = buffer.slice(offset, offset + dataLen);
      offset += dataLen;

      files.push({ path: pathStr, data });
    }

    return files;
  }

  private getEncryptionKey(vault: SecureVault): Buffer {
    try {
      const keyStr = vault.get('SNAPSHOT_KEY');
      return crypto.createHash('sha256').update(keyStr).digest();
    } catch (e) {
      const newKey = crypto.randomBytes(32).toString('hex');
      vault.set('SNAPSHOT_KEY', newKey);
      return crypto.createHash('sha256').update(newKey).digest();
    }
  }

  async createSnapshot(vault: SecureVault): Promise<{ data: Buffer, checksum: string }> {
    const filePaths = this.getAllFiles();
    const files = filePaths.map(p => ({
      path: p,
      data: fs.readFileSync(p)
    }));

    const packed = this.pack(files);
    const compressed = await gzip(packed);
    
    const key = this.getEncryptionKey(vault);
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    
    const encrypted = Buffer.concat([cipher.update(compressed), cipher.final()]);
    const authTag = cipher.getAuthTag();
    
    const finalBuffer = Buffer.concat([iv, authTag, encrypted]);
    const checksum = crypto.createHash('sha256').update(finalBuffer).digest('hex');
    
    return { data: finalBuffer, checksum };
  }

  async restoreSnapshot(data: Buffer, checksum: string, vault: SecureVault): Promise<boolean> {
    const actualChecksum = crypto.createHash('sha256').update(data).digest('hex');
    if (actualChecksum !== checksum) {
      console.error('[SNAPSHOT] Checksum mismatch');
      return false;
    }

    try {
      const key = this.getEncryptionKey(vault);
      const iv = data.slice(0, 12);
      const authTag = data.slice(12, 28);
      const encryptedData = data.slice(28);
      
      const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
      decipher.setAuthTag(authTag);
      
      const compressed = Buffer.concat([decipher.update(encryptedData), decipher.final()]);
      const packed = await gunzip(compressed);
      const files = this.unpack(packed);
      
      for (const file of files) {
        const dir = path.dirname(file.path);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(file.path, file.data);
      }
      
      // Integrity check for memory.db
      if (fs.existsSync(this.dbPath)) {
        try {
          const db = new Database(this.dbPath);
          const result = db.pragma('integrity_check') as any;
          db.close();
          
          if (!result || result.length === 0 || result[0].integrity_check !== 'ok') {
            console.error('[SNAPSHOT] Database integrity check failed:', result);
            return false;
          }
        } catch (dbErr) {
          console.error('[SNAPSHOT] Could not open database for integrity check:', dbErr);
          return false;
        }
      }
      
      return true;
    } catch (e) {
      console.error('[SNAPSHOT] Restoration failed:', e);
      return false;
    }
  }
}
