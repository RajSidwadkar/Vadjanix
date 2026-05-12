import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FederatedSkillSync, ProceduralCapsule } from '../src/relay/federated_sync.js';
import { GhostSandbox } from '../src/agent/ghost_sandbox.js';

// Mock nostr-tools
vi.mock('nostr-tools', () => {
  class SimplePool {
    publish = vi.fn().mockReturnValue([Promise.resolve()]);
    querySync = vi.fn().mockResolvedValue([]);
  }
  return {
    SimplePool,
    finalizeEvent: vi.fn().mockReturnValue({ sig: 'mock_sig' }),
    verifyEvent: vi.fn().mockReturnValue(true)
  };
});

// Mock ed25519
vi.mock('@noble/ed25519', () => ({
  sign: vi.fn().mockResolvedValue(new Uint8Array(64)),
  verify: vi.fn().mockResolvedValue(true)
}));

describe('FederatedSkillSync', () => {
  let sandbox: GhostSandbox;
  let sync: FederatedSkillSync;
  const mockPubkey = '00'.repeat(32);
  const mockPrivkey = '11'.repeat(32);

  beforeEach(() => {
    sandbox = new GhostSandbox();
    sync = new FederatedSkillSync('ws://relay', sandbox, mockPubkey, mockPrivkey);
  });

  it('publishSkill() returns false for low successRate', async () => {
    const lowSkill: ProceduralCapsule = {
      skillId: 'low_success',
      description: 'test',
      triggerPattern: 'test',
      procedureCode: 'console.log("test")',
      successRate: 0.5, // < 0.8
      evidenceCount: 10,
      domain: 'test',
      createdBy: mockPubkey,
      signature: '',
      createdAt: Date.now()
    };
    const result = await sync.publishSkill(lowSkill);
    expect(result).toBe(false);
  });

  it('publishSkill() returns false for low evidenceCount', async () => {
    const lowSkill: ProceduralCapsule = {
      skillId: 'low_evidence',
      description: 'test',
      triggerPattern: 'test',
      procedureCode: 'console.log("test")',
      successRate: 0.9,
      evidenceCount: 2, // < 3
      domain: 'test',
      createdBy: mockPubkey,
      signature: '',
      createdAt: Date.now()
    };
    const result = await sync.publishSkill(lowSkill);
    expect(result).toBe(false);
  });

  it('distillCapsuleFromEpisode() removes phone numbers and JIDs from code', () => {
    const episode = {
      outcome: 'success',
      procedureCode: 'Call +12345678901 or message 9876543210@s.whatsapp.net or group 111@g.us. My email is owner@gmail.com',
      description: 'test',
      successRate: 0.9,
      evidenceCount: 5
    };
    const capsule = sync.distillCapsuleFromEpisode(episode);
    expect(capsule).not.toBeNull();
    expect(capsule?.procedureCode).not.toContain('+12345678901');
    expect(capsule?.procedureCode).toContain('[PHONE_REDACTED]');
    expect(capsule?.procedureCode).not.toContain('9876543210@s.whatsapp.net');
    expect(capsule?.procedureCode).toContain('[JID_REDACTED]');
    expect(capsule?.procedureCode).not.toContain('111@g.us');
    expect(capsule?.procedureCode).toContain('[GROUP_JID_REDACTED]');
    expect(capsule?.procedureCode).not.toContain('owner@gmail.com');
    expect(capsule?.procedureCode).toContain('[EMAIL_REDACTED]');
  });

  it('syncNewSkills() tests each skill in sandbox before adopting', async () => {
    const mockSkill: ProceduralCapsule = {
      skillId: 'remote_skill',
      description: 'test',
      triggerPattern: 'test',
      procedureCode: 'console.log("remote")',
      successRate: 0.9,
      evidenceCount: 5,
      domain: 'test',
      createdBy: 'other_pubkey',
      signature: '00'.repeat(64),
      createdAt: Date.now()
    };

    const pool = (sync as any).pool;
    pool.querySync.mockResolvedValue([{
      kind: 30078,
      content: JSON.stringify(mockSkill),
      pubkey: '00'.repeat(32),
      sig: 'sig'
    }]);

    // Mock sandbox to succeed
    vi.spyOn(sandbox, '_runSandboxed').mockResolvedValue({
      success: true,
      stdout: 'remote',
      stderr: '',
      exitCode: 0,
      iterations: 1
    });

    const adopted = await sync.syncNewSkills();
    expect(adopted.length).toBe(1);
    expect(adopted[0].skillId).toBe('remote_skill');
    expect(sandbox._runSandboxed).toHaveBeenCalledWith('console.log("remote")');

    // Mock sandbox to fail for second skill
    const failSkill = { ...mockSkill, skillId: 'fail_skill', procedureCode: 'throw new Error()' };
    pool.querySync.mockResolvedValue([
      { kind: 30078, content: JSON.stringify(mockSkill), pubkey: '00'.repeat(32), sig: 'sig' },
      { kind: 30078, content: JSON.stringify(failSkill), pubkey: '00'.repeat(32), sig: 'sig' }
    ]);
    
    vi.spyOn(sandbox, '_runSandboxed')
      .mockResolvedValueOnce({ success: true, stdout: '', stderr: '', exitCode: 0, iterations: 1 })
      .mockResolvedValueOnce({ success: false, stdout: '', stderr: 'error', exitCode: 1, iterations: 1 });

    sync.knownSkills.clear();
    const adopted2 = await sync.syncNewSkills();
    expect(adopted2.length).toBe(1);
    expect(adopted2[0].skillId).toBe('remote_skill');
  });
});
