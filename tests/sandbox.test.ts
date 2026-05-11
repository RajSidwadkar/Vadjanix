import { describe, it, expect, vi } from 'vitest';
import { GhostSandbox } from '../src/agent/ghost_sandbox.js';
import { IntentVerifier } from '../src/agent/intent_verifier.js';
import { LLMAdapter } from '../src/core/llm_adapter.js';

describe('GhostSandbox', () => {
  it('should run safe code successfully', async () => {
    const sandbox = new GhostSandbox();
    const result = await sandbox._runSandboxed('console.log("hello world");');
    expect(result.success).toBe(true);
    expect(result.stdout).toBe('hello world');
  });

  it('should strip dangerous imports', async () => {
    const sandbox = new GhostSandbox();
    const code = `
      try {
        const fs = require('fs');
        console.log('fs_type:', typeof fs.readFileSync);
      } catch (e) {
        console.log('error_caught');
      }
    `;
    const result = await sandbox._runSandboxed(code);
    expect(result.success).toBe(true);
    // require('fs') is replaced by {}
    expect(result.stdout).toContain('fs_type: undefined');
  });

  it('should timeout on infinite loops', async () => {
    const sandbox = new GhostSandbox();
    // Default timeout is 5000ms, which is a bit long for tests but okay
    const result = await sandbox._runSandboxed('while(true) {}');
    expect(result.success).toBe(false);
    expect(result.stderr).toMatch(/CPU_TIMEOUT_MS exceeded|Isolate was disposed/);
  }, 10000);

  it('should handle memory limits', async () => {
    const sandbox = new GhostSandbox();
    // Try to allocate lots of memory
    const code = `
      const arr = [];
      while(true) {
        arr.push(new Array(1000000).fill(0));
      }
    `;
    const result = await sandbox._runSandboxed(code);
    expect(result.success).toBe(false);
    expect(result.stderr).toMatch(/memory limit|Isolate was disposed/);
  }, 10000);
});

describe('IntentVerifier', () => {
  it('should return matches=true for valid action', async () => {
    const mockAdapter: LLMAdapter = {
      name: 'mock',
      reason: vi.fn().mockResolvedValue({ text: 'YES. The action matches.', confidence: 1 }),
      isAvailable: async () => true
    };
    const verifier = new IntentVerifier(mockAdapter);
    const result = await verifier.verify('Send 5 dollars', 'I am sending 5 dollars');
    expect(result.matches).toBe(true);
  });

  it('should return matches=false for mismatched action and create MCQ', async () => {
    const mockAdapter: LLMAdapter = {
      name: 'mock',
      reason: vi.fn().mockResolvedValue({ text: 'NO. You are deleting files instead of sending money.', confidence: 0.9, context: {} }),
      isAvailable: async () => true
    };
    const verifier = new IntentVerifier(mockAdapter);
    const result = await verifier.verify('Send 5 dollars', 'Delete all files');
    expect(result.matches).toBe(false);
    expect(result.concern).toContain('deleting files');
    expect(result.mcqId).toBeDefined();
    expect(result.mcqId).toMatch(/^mcq_/);
  });
});
