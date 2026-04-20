import { expect } from 'chai';
import { BN } from '@coral-xyz/anchor';
import { PublicKey } from '@solana/web3.js';
import { SablePayments } from '@sable/sdk';
import { setupUser, sleep } from './helpers/setup';
import { checkConservation } from './helpers/conservation';
import { env } from './helpers/env';

describe('08-private-payments-api', () => {
  let wallet: Awaited<ReturnType<typeof setupUser>>['wallet'];
  let payments: SablePayments;

  before(async () => {
    const result = await setupUser();
    wallet = result.wallet;
    payments = new SablePayments({ apiUrl: env.SABLE_PRIVATE_PAYMENTS_API_URL, cluster: 'devnet' });
  });

  it('can build deposit transaction', async () => {
    const tx = await payments.buildDeposit({
      from: wallet.publicKey,
      amount: new BN(100_000),
    });
    expect(tx).to.not.be.null;
    expect(tx.instructions.length).to.be.greaterThan(0);
  });

  it('can get balance', async () => {
    const usdcMint = new PublicKey('4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU');
    const balance = await payments.getBalance({ owner: wallet.publicKey, mint: usdcMint });
    expect(balance).to.be.instanceOf(BN);
  });
});
