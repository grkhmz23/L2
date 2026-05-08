import { getMint } from '@solana/spl-token';
import { BN } from '@coral-xyz/anchor';
import type { Connection, PublicKey } from '@solana/web3.js';

export async function getMintDecimals(connection: Connection, mint: PublicKey): Promise<number> {
  const mintInfo = await getMint(connection, mint);
  return mintInfo.decimals;
}

export function parseTokenAmount(input: string, decimals: number): BN {
  const value = input.trim();
  if (!value) {
    throw new Error('Amount is required');
  }
  if (!/^\d+(\.\d+)?$/.test(value)) {
    throw new Error('Amount must be a positive decimal number');
  }

  const [whole, fractional = ''] = value.split('.');
  if (fractional.length > decimals) {
    throw new Error(`Amount supports at most ${decimals} decimal place(s) for this mint`);
  }

  const paddedFractional = fractional.padEnd(decimals, '0');
  const raw = `${whole}${paddedFractional}`.replace(/^0+(?=\d)/, '') || '0';
  const amount = new BN(raw);
  if (amount.lte(new BN(0))) {
    throw new Error('Amount must be greater than zero');
  }
  return amount;
}
