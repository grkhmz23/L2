import { describe, expect, it, vi } from 'vitest';
import { POST } from './route';

describe('agent route fallback', () => {
  it('does not call LLM for out-of-scope messages', async () => {
    const oldProvider = process.env.SABLE_AGENT_LLM_PROVIDER;
    const oldKey = process.env.SABLE_AGENT_LLM_API_KEY;
    process.env.SABLE_AGENT_LLM_PROVIDER = 'deepseek';
    process.env.SABLE_AGENT_LLM_API_KEY = 'test-key';
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('should not be called'));

    const response = await POST(
      new Request('http://localhost/api/agent', {
        method: 'POST',
        body: JSON.stringify({ message: 'What is Bitcoin?', context: {} }),
      })
    );
    const body = await response.json();

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(body.plan.actionType).toBe('OUT_OF_SCOPE');
    expect(body.plan.summary).toContain('I can only help with Sable treasury actions');

    fetchSpy.mockRestore();
    process.env.SABLE_AGENT_LLM_PROVIDER = oldProvider;
    process.env.SABLE_AGENT_LLM_API_KEY = oldKey;
  });

  it('asks a local Sable clarification for ambiguous messages', async () => {
    const response = await POST(
      new Request('http://localhost/api/agent', {
        method: 'POST',
        body: JSON.stringify({ message: 'help me', context: {} }),
      })
    );
    const body = await response.json();

    expect(body.plan.actionType).toBe('CLARIFY_SABLE_ACTION');
    expect(body.plan.summary).toContain('Which Sable action');
  });

  it('falls back safely when the LLM returns malformed JSON', async () => {
    const oldProvider = process.env.SABLE_AGENT_LLM_PROVIDER;
    const oldKey = process.env.SABLE_AGENT_LLM_API_KEY;
    process.env.SABLE_AGENT_LLM_PROVIDER = 'deepseek';
    process.env.SABLE_AGENT_LLM_API_KEY = 'test-key';
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'not json' } }] }),
    } as Response);

    const response = await POST(
      new Request('http://localhost/api/agent', {
        method: 'POST',
        body: JSON.stringify({ message: 'deposit 1 usdc', context: { usdcMint: '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU' } }),
      })
    );
    const body = await response.json();

    expect(body.usedFallback).toBe(true);
    expect(body.plan.actionType).toBe('DEPOSIT');

    fetchSpy.mockRestore();
    process.env.SABLE_AGENT_LLM_PROVIDER = oldProvider;
    process.env.SABLE_AGENT_LLM_API_KEY = oldKey;
  });
});
