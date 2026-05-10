import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CommandHandler } from '../src/agent/command_handler.js';
import { CapsuleManager } from '../src/agent/capsule.js';
import { GoalTracker } from '../src/modules/autonomy/goals.js';

vi.mock('../src/agent/capsule.js');
vi.mock('../src/modules/autonomy/goals.js');

describe('CommandHandler', () => {
  let handler: CommandHandler;

  beforeEach(() => {
    vi.clearAllMocks();
    handler = new CommandHandler();
  });

  it('handles status command', async () => {
    const response = await handler.handleOwnerCommand('status');
    expect(response).toContain('Vadjanix Status: ACTIVE');
  });

  it('handles pause and resume commands', async () => {
    let response = await handler.handleOwnerCommand('pause');
    expect(response).toContain('Global pause activated');
    expect(CommandHandler.getPaused()).toBe(true);

    response = await handler.handleOwnerCommand('status');
    expect(response).toContain('Vadjanix Status: PAUSED');

    response = await handler.handleOwnerCommand('resume');
    expect(response).toContain('System resumed');
    expect(CommandHandler.getPaused()).toBe(false);
  });

  it('handles goals command', async () => {
    vi.mocked(GoalTracker.prototype.getPendingGoals).mockReturnValue(['Goal 1']);
    const response = await handler.handleOwnerCommand('goals');
    expect(response).toContain('• Goal 1');
  });

  it('handles undo command', async () => {
    vi.mocked(CapsuleManager.prototype.rollback).mockResolvedValue({ success: true, restored: 'Previous Action' });
    const response = await handler.handleOwnerCommand('undo cap_123');
    expect(response).toContain('Rollback successful: Previous Action');
  });
});
