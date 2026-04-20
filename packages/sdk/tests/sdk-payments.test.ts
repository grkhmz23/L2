import { spawn, ChildProcess } from 'child_process';
import { Keypair, PublicKey, Transaction } from '@solana/web3.js';
import { BN } from '@coral-xyz/anchor';
import { assert } from 'chai';
import { SablePayments, AmlRejectedError, PaymentsApiError } from '../src/payments';

describe('SDK Payments (mock API)', () => {
  let mockServer: ChildProcess;
  let apiUrl: string;
  let payments: SablePayments;

  before(async function () {
    this.timeout(15000);

    const port = 4444 + Math.floor(Math.random() * 1000);
    apiUrl = `http://localhost:${port}`;
    payments = new SablePayments({ apiUrl });

    mockServer = spawn(
      'node',
      ['-e', `
        process.env.PAYMENTS_MOCK_PORT = '${port}';
        process.env.SOLANA_RPC_URL = 'http://localhost:8899';
        require('../../services/payments-api-mock/dist/server.js');
      `],
      { cwd: process.cwd(), stdio: 'pipe' }
    );

    // Wait for server to be ready
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Mock server startup timeout')), 8000);
      const check = setInterval(async () => {
        try {
          const res = await fetch(`${apiUrl}/health`);
          if (res.ok) {
            clearInterval(check);
            clearTimeout(timeout);
            resolve();
          }
        } catch {
          // retry
        }
      }, 200);
    });
  });

  after(async () => {
    if (mockServer) {
      mockServer.kill();
    }
  });

  it('buildDeposit returns a valid unsigned Transaction', async () => {
    const from = Keypair.generate().publicKey;
    const amount = new BN(1_000_000);

    const tx = await payments.buildDeposit({ from, amount });
    assert.instanceOf(tx, Transaction);
    assert.isAbove(tx.instructions.length, 0);
  });

  it('buildTransfer returns a valid unsigned Transaction', async () => {
    const from = Keypair.generate().publicKey;
    const to = Keypair.generate().publicKey;
    const amount = new BN(500_000);

    const tx = await payments.buildTransfer({ from, to, amount });
    assert.instanceOf(tx, Transaction);
    assert.isAbove(tx.instructions.length, 0);
  });

  it('buildWithdraw returns a valid unsigned Transaction', async () => {
    const from = Keypair.generate().publicKey;
    const to = Keypair.generate().publicKey;
    const amount = new BN(250_000);

    const tx = await payments.buildWithdraw({ from, to, amount });
    assert.instanceOf(tx, Transaction);
    assert.isAbove(tx.instructions.length, 0);
  });

  it('getBalance returns zero for unknown account', async () => {
    const owner = Keypair.generate().publicKey;
    const balance = await payments.getBalance({ owner });
    assert.instanceOf(balance, BN);
    assert.equal(balance.toString(), '0');
  });

  it('getMintInitStatus returns false for uninitialized mint', async () => {
    const mint = Keypair.generate().publicKey;
    const status = await payments.getMintInitStatus({ mint });
    assert.isFalse(status);
  });

  it('initMint returns a valid unsigned Transaction and marks mint initialized', async () => {
    const mint = Keypair.generate().publicKey;

    const tx = await payments.initMint({ mint });
    assert.instanceOf(tx, Transaction);
    assert.isAbove(tx.instructions.length, 0);

    const status = await payments.getMintInitStatus({ mint });
    assert.isTrue(status);
  });

  it('aml.screen passes for clean address', async () => {
    const result = await payments.aml.screen({ address: Keypair.generate().publicKey.toBase58() });
    assert.isTrue(result.ok);
  });

  it('aml.screen rejects OFAC test address with AmlRejectedError', async () => {
    const ofacAddress = 'OFAC_TEST_ADDRESS_12345';
    try {
      await payments.aml.screen({ address: ofacAddress });
      assert.fail('Expected AmlRejectedError');
    } catch (err) {
      assert.instanceOf(err, AmlRejectedError);
      assert.include((err as AmlRejectedError).reason, 'OFAC');
    }
  });

  it('handles API errors gracefully', async () => {
    // Missing required fields should trigger 400 on the mock
    const badPayments = new SablePayments({ apiUrl: `${apiUrl}/nonexistent` });
    try {
      await badPayments.getBalance({ owner: Keypair.generate().publicKey });
      assert.fail('Expected PaymentsApiError');
    } catch (err) {
      assert.instanceOf(err, PaymentsApiError);
    }
  });
});
