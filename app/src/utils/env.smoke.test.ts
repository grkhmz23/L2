import { describe, expect, it } from 'vitest';
import { PublicKey } from '@solana/web3.js';
import { env } from './env';

describe('env smoke', () => {
  it('exposes valid default demo configuration', () => {
    expect(env.SOLANA_RPC_URL).toBeTruthy();
    expect(() => new PublicKey(env.SABLE_PROGRAM_ID)).not.toThrow();
    expect(env.PAYMENTS_API_URL).toBe('');
  });
});
