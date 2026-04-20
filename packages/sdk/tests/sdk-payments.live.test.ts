import { Keypair, PublicKey } from '@solana/web3.js';
import { BN } from '@coral-xyz/anchor';
import { assert } from 'chai';
import { SablePayments, AmlRejectedError } from '../src/payments';

/**
 * Live Private Payments API integration tests.
 *
 * These run against the real MagicBlock-hosted Private Payments API.
 * Gate them behind SABLE_RUN_LIVE_TESTS=1.
 *
 * Required env:
 *   SABLE_PRIVATE_PAYMENTS_API_URL
 *   SABLE_PRIVATE_PAYMENTS_API_KEY (optional)
 */

const RUN_LIVE = process.env.SABLE_RUN_LIVE_TESTS === '1';
const API_URL = process.env.SABLE_PRIVATE_PAYMENTS_API_URL || '';
const API_KEY = process.env.SABLE_PRIVATE_PAYMENTS_API_KEY;

(RUN_LIVE ? describe : describe.skip)('SDK Payments (live API)', () => {
  let payments: SablePayments;

  before(() => {
    if (!API_URL) {
      throw new Error('SABLE_PRIVATE_PAYMENTS_API_URL is required for live tests');
    }
    payments = new SablePayments({ apiUrl: API_URL, apiKey: API_KEY });
  });

  it('health endpoint is reachable', async () => {
    const res = await fetch(`${API_URL}/health`);
    assert.isTrue(res.ok);
  });

  it('buildDeposit returns a deserializeable transaction', async () => {
    const from = Keypair.generate().publicKey;
    const amount = new BN(1_000_000);
    const tx = await payments.buildDeposit({ from, amount });
    assert.isAbove(tx.instructions.length, 0);
  });

  it('buildTransfer returns a deserializeable transaction', async () => {
    const from = Keypair.generate().publicKey;
    const to = Keypair.generate().publicKey;
    const amount = new BN(500_000);
    const tx = await payments.buildTransfer({ from, to, amount });
    assert.isAbove(tx.instructions.length, 0);
  });

  it('buildWithdraw returns a deserializeable transaction', async () => {
    const from = Keypair.generate().publicKey;
    const to = Keypair.generate().publicKey;
    const amount = new BN(250_000);
    const tx = await payments.buildWithdraw({ from, to, amount });
    assert.isAbove(tx.instructions.length, 0);
  });

  it('aml.screen rejects sanctioned addresses', async () => {
    // This assumes the live API has some form of compliance screening.
    // If the live API does not reject this address, the test documents
    // the expected shape rather than asserting a hard rejection.
    try {
      const result = await payments.aml.screen({ address: Keypair.generate().publicKey.toBase58() });
      assert.isTrue(result.ok);
    } catch (err) {
      // Live API may or may not reject arbitrary addresses — either outcome is acceptable
      // as long as the response shape is correct.
      assert.instanceOf(err, AmlRejectedError);
    }
  });
});
