import { GhostSandbox } from '../agent/ghost_sandbox.js';
import * as ed from '@noble/ed25519';
import { 
  SimplePool, 
  finalizeEvent, 
  verifyEvent,
  Event
} from 'nostr-tools';
import * as fs from 'fs';
import * as path from 'path';

export interface ProceduralCapsule {
  skillId: string;
  description: string;
  triggerPattern: string;
  procedureCode: string;
  successRate: number;
  evidenceCount: number;
  domain: string;
  createdBy: string;
  signature: string; // ed25519 signature of the capsule content
  createdAt: number;
}

export class FederatedSkillSync {
  public knownSkills: Set<string> = new Set();
  private pool: SimplePool;
  private contacts: any;
  private owner: any;

  constructor(
    private nostrRelay: string,
    private sandbox: GhostSandbox,
    private agentPubkey: string,
    private agentPrivkey: string
  ) {
    this.pool = new SimplePool();
    this._loadPIIData();
  }

  private _loadPIIData() {
    try {
      this.contacts = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'config', 'CONTACTS.json'), 'utf8'));
      this.owner = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'config', 'OWNER.json'), 'utf8'));
    } catch (e) {
      this.contacts = { owner: '', protected: [], agents: [] };
      this.owner = { jid: '', name: '' };
    }
  }

  async publishSkill(skill: ProceduralCapsule): Promise<boolean> {
    // Gate 1: successRate < 0.8 OR evidenceCount < 3 -> return false
    if (skill.successRate < 0.8 || skill.evidenceCount < 3) {
      return false;
    }

    // Gate 2: test in Ghost Sandbox -> if fails -> return false
    const testResult = await this.sandbox._runSandboxed(skill.procedureCode);
    if (!testResult.success) {
      return false;
    }

    // Sign capsule with @noble/ed25519 as requested
    const capsuleData = JSON.stringify({
      skillId: skill.skillId,
      procedureCode: skill.procedureCode,
      successRate: skill.successRate
    });
    const msgHash = new TextEncoder().encode(capsuleData);
    const sig = await ed.sign(msgHash, Buffer.from(this.agentPrivkey, 'hex'));
    skill.signature = Buffer.from(sig).toString('hex');

    // Publish to Nostr
    const eventTemplate = {
      kind: 30078,
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ['t', 'vadjanix-skill'],
        ['domain', skill.domain],
        ['skillId', skill.skillId]
      ],
      content: JSON.stringify(skill)
    };

    try {
      const signedEvent = finalizeEvent(eventTemplate, Buffer.from(this.agentPrivkey, 'hex'));
      await Promise.any(this.pool.publish([this.nostrRelay], signedEvent));
      return true;
    } catch (e) {
      return false;
    }
  }

  async syncNewSkills(): Promise<ProceduralCapsule[]> {
    const skills = await this._fetchRemoteSkills();
    const adopted: ProceduralCapsule[] = [];

    for (const skill of skills) {
      try {
        if (this.knownSkills.has(skill.skillId)) continue;

        // Verify ed25519 signature of capsule
        const capsuleData = JSON.stringify({
          skillId: skill.skillId,
          procedureCode: skill.procedureCode,
          successRate: skill.successRate
        });
        const msgHash = new TextEncoder().encode(capsuleData);
        // Note: For verification, we need the pubkey from somewhere. 
        // In _fetchRemoteSkills, we already verified the event, but we need the pubkey to verify the internal signature.
        // We'll assume the capsule's createdBy or the event's pubkey.
        const isValid = await ed.verify(Buffer.from(skill.signature, 'hex'), msgHash, Buffer.from(skill.createdBy, 'hex'));
        if (!isValid) continue;

        // Test in Ghost Sandbox
        const testResult = await this.sandbox._runSandboxed(skill.procedureCode);
        if (testResult.success) {
          this.knownSkills.add(skill.skillId);
          adopted.push(skill);
        }
      } catch (e) {
        continue;
      }
    }

    return adopted;
  }

  private async _fetchRemoteSkills(): Promise<ProceduralCapsule[]> {
    const events = await this.pool.querySync([this.nostrRelay], {
      kinds: [30078],
      '#t': ['vadjanix-skill']
    });

    const skills: ProceduralCapsule[] = [];
    for (const event of events) {
      try {
        if (verifyEvent(event)) {
          const skill: ProceduralCapsule = JSON.parse(event.content);
          skills.push(skill);
        }
      } catch (e) {
        // ignore malformed events
      }
    }
    return skills;
  }

  distillCapsuleFromEpisode(episode: any): ProceduralCapsule | null {
    if (episode.outcome !== 'success') {
      return null;
    }

    let strippedCode = episode.procedureCode || '';

    // STRIP ALL PII from procedureCode
    // 1. WhatsApp JIDs (must come before phone numbers)
    strippedCode = strippedCode.replace(/\d+@s\.whatsapp\.net/g, '[JID_REDACTED]');
    strippedCode = strippedCode.replace(/\d+@g\.us/g, '[GROUP_JID_REDACTED]');

    // 2. Remove phone numbers (regex)
    strippedCode = strippedCode.replace(/\+?\d[\d-\s]{8,}\d/g, '[PHONE_REDACTED]');

    // 3. Email addresses
    strippedCode = strippedCode.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[EMAIL_REDACTED]');

    // Helper to escape regex special characters
    const escapeRegExp = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // 4. Data from CONTACTS.json
    if (this.contacts.owner) {
      strippedCode = strippedCode.replace(new RegExp(escapeRegExp(this.contacts.owner), 'g'), '[OWNER_JID_REDACTED]');
    }
    if (this.contacts.protected) {
      for (const entry of this.contacts.protected) {
        if (entry) {
          strippedCode = strippedCode.replace(new RegExp(escapeRegExp(entry), 'g'), '[PROTECTED_CONTACT_REDACTED]');
        }
      }
    }
    if (this.contacts.agents) {
      for (const entry of this.contacts.agents) {
        if (entry) {
          strippedCode = strippedCode.replace(new RegExp(escapeRegExp(entry), 'g'), '[AGENT_JID_REDACTED]');
        }
      }
    }

    // 5. OWNER.json data
    for (const key in this.owner) {
      if (this.owner[key] && typeof this.owner[key] === 'string') {
        strippedCode = strippedCode.replace(new RegExp(escapeRegExp(this.owner[key]), 'g'), `[OWNER_${key.toUpperCase()}_REDACTED]`);
      }
    }

    return {
      skillId: `skill_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
      description: episode.description || 'Auto-distilled skill',
      triggerPattern: episode.triggerPattern || '',
      procedureCode: strippedCode,
      successRate: episode.successRate || 1.0,
      evidenceCount: episode.evidenceCount || 1,
      domain: episode.domain || 'general',
      createdBy: this.agentPubkey,
      signature: '', // Will be signed on publish
      createdAt: Math.floor(Date.now() / 1000)
    };
  }
}
