import crypto from 'node:crypto';
import fs from 'node:fs';

export class SecureVault {
  private key: Buffer;
  private readonly vaultPath = '.vault';
  private readonly saltPath = '.vault.salt';

  constructor(masterPassword: string) {
    let salt: Buffer;
    if (fs.existsSync(this.saltPath)) {
      salt = fs.readFileSync(this.saltPath);
    } else {
      salt = crypto.randomBytes(16);
      fs.writeFileSync(this.saltPath, salt);
    }
    this.key = crypto.scryptSync(masterPassword, salt, 32);
  }

  private getVault(): Record<string, string> {
    if (!fs.existsSync(this.vaultPath)) return {};
    return JSON.parse(fs.readFileSync(this.vaultPath, 'utf8'));
  }

  set(name: string, value: string): void {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', this.key, iv);
    let encrypted = cipher.update(value, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');
    
    const vault = this.getVault();
    vault[name] = `${iv.toString('hex')}:${authTag}:${encrypted}`;
    fs.writeFileSync(this.vaultPath, JSON.stringify(vault));
  }

  get(name: string): string {
    const vault = this.getVault();
    const data = vault[name];
    if (!data) throw new Error(`Key ${name} not found in vault`);

    const [ivHex, authTagHex, encrypted] = data.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-gcm', this.key, iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }
}
