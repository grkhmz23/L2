import { describe, expect, it } from 'vitest';
import { parseTokenAmount } from './amount';

describe('token amount parser smoke', () => {
  it('parses UI decimals into raw integer units', () => {
    expect(parseTokenAmount('1.25', 6).toString()).toBe('1250000');
    expect(parseTokenAmount('0.000000001', 9).toString()).toBe('1');
  });

  it('rejects precision that the mint cannot represent', () => {
    expect(() => parseTokenAmount('0.0000001', 6)).toThrow(/at most 6/);
  });
});
