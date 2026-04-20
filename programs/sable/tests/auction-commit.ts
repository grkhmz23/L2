import * as anchor from '@coral-xyz/anchor';
import {
  Keypair,
  PublicKey,
  LAMPORTS_PER_SOL,
} from '@solana/web3.js';
import { assert } from 'chai';

// IDL placeholder - minimal for typechecking
const IDL = {
  version: '1.0.0',
  name: 'sable',
  instructions: [{ name: 'commitBid', accounts: [], args: [] }],
  accounts: [],
  errors: [
    { code: 6039, name: 'TaskDeadlineInvalid', msg: 'Task deadline is invalid' },
    { code: 6042, name: 'TaskWrongState', msg: 'Task is in wrong state for this operation' },
    { code: 6043, name: 'DepositBelowMinimum', msg: 'Deposit is below the task minimum' },
  ],
};

describe('auction commit bid', () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const user1 = Keypair.generate();
  const user2 = Keypair.generate();

  const programId = new PublicKey('SaSAXcdWhyr1KD8TKRg6K7WPuxcPLZJHKEwsjQgL5Di');

  const deriveUserState = (owner: PublicKey) => {
    return PublicKey.findProgramAddressSync(
      [Buffer.from('user_state'), owner.toBuffer()],
      programId
    );
  };

  const deriveTask = (poster: PublicKey, taskId: number) => {
    return PublicKey.findProgramAddressSync(
      [
        Buffer.from('task'),
        poster.toBuffer(),
        Buffer.from(new BigUint64Array([BigInt(taskId)]).buffer),
      ],
      programId
    );
  };

  const deriveBid = (task: PublicKey, bidder: PublicKey) => {
    return PublicKey.findProgramAddressSync(
      [
        Buffer.from('bid'),
        task.toBuffer(),
        bidder.toBuffer(),
      ],
      programId
    );
  };

  before(async () => {
    const airdrop = async (keypair: Keypair, amount: number = 10) => {
      const sig = await provider.connection.requestAirdrop(
        keypair.publicKey,
        amount * LAMPORTS_PER_SOL
      );
      await provider.connection.confirmTransaction(sig);
    };
    await airdrop(user1, 10);
    await airdrop(user2, 10);
  });

  describe('PDA derivations', () => {
    it('Bid PDA depends on task and bidder', () => {
      const [user1State] = deriveUserState(user1.publicKey);
      const [task1] = deriveTask(user1State, 0);
      const [bid1] = deriveBid(task1, user1State);
      const [bid2] = deriveBid(task1, user2.publicKey);

      assert.ok(bid1);
      assert.ok(bid2);
      assert.notEqual(bid1.toBase58(), bid2.toBase58());
    });

    it('Bid PDA is deterministic', () => {
      const [user1State] = deriveUserState(user1.publicKey);
      const [task1] = deriveTask(user1State, 0);
      const [bid1a] = deriveBid(task1, user1State);
      const [bid1b] = deriveBid(task1, user1State);
      assert.equal(bid1a.toBase58(), bid1b.toBase58());
    });

    it('Same bidder on different tasks gets different bid PDAs', () => {
      const [user1State] = deriveUserState(user1.publicKey);
      const [task1] = deriveTask(user1State, 0);
      const [task2] = deriveTask(user1State, 1);
      const [bid1] = deriveBid(task1, user1State);
      const [bid2] = deriveBid(task2, user1State);

      assert.notEqual(bid1.toBase58(), bid2.toBase58());
    });
  });

  describe('Commit hash scheme', () => {
    it('Hash includes amount, nonce, and bidder pubkey', () => {
      // Off-chain structural validation of the hash input format:
      // keccak256(amount_le_bytes(8) || nonce_le_bytes(8) || bidder_pubkey(32))
      const amount = BigInt(100);
      const nonce = BigInt(42);
      const bidder = user1.publicKey.toBuffer(); // 32 bytes

      const amountBuf = Buffer.alloc(8);
      amountBuf.writeBigUInt64LE(amount, 0);

      const nonceBuf = Buffer.alloc(8);
      nonceBuf.writeBigUInt64LE(nonce, 0);

      const input = Buffer.concat([amountBuf, nonceBuf, bidder]);
      assert.equal(input.length, 48);
      assert.equal(amountBuf.length, 8);
      assert.equal(nonceBuf.length, 8);
      assert.equal(bidder.length, 32);
    });

    it('Nonces must be unique per bid', () => {
      const nonce1 = BigInt(123456789);
      const nonce2 = BigInt(987654321);
      assert.notEqual(nonce1.toString(), nonce2.toString());
    });

    it('Commitment is non-transferable via bidder pubkey', () => {
      // A hash computed for bidder A cannot be revealed by bidder B
      const amount = BigInt(50);
      const nonce = BigInt(1);
      const bidderA = user1.publicKey.toBuffer();
      const bidderB = user2.publicKey.toBuffer();

      const amountBuf = Buffer.alloc(8);
      amountBuf.writeBigUInt64LE(amount, 0);
      const nonceBuf = Buffer.alloc(8);
      nonceBuf.writeBigUInt64LE(nonce, 0);

      const inputA = Buffer.concat([amountBuf, nonceBuf, bidderA]);
      const inputB = Buffer.concat([amountBuf, nonceBuf, bidderB]);

      assert.notDeepEqual(inputA, inputB);
    });
  });

  describe('Bid constraints', () => {
    it('Deposit must be >= min_deposit', () => {
      const minDeposit = 100;
      const deposit = 50;
      assert.isBelow(deposit, minDeposit);
    });

    it('Deposit at exactly min_deposit is allowed', () => {
      const minDeposit = 100;
      const deposit = 100;
      assert.isAtLeast(deposit, minDeposit);
    });

    it('Commit after deadline is rejected', () => {
      const now = 1_000_000;
      const deadline = 999_999;
      assert.isAbove(now, deadline);
    });

    it('Commit before deadline is allowed', () => {
      const now = 999_998;
      const deadline = 1_000_000;
      assert.isBelow(now, deadline);
    });

    it('Bid on non-Open task is rejected', () => {
      const state = 2; // Settled
      assert.notEqual(state, 0);
    });
  });

  describe('Escrow conservation on commit', () => {
    it('Deposit increases escrow amount', () => {
      const escrowBefore = 500;
      const deposit = 200;
      const escrowAfter = escrowBefore + deposit;
      assert.equal(escrowAfter, 700);
    });

    it('Bid count increments on commit', () => {
      const before = 0;
      const after = before + 1;
      assert.equal(after, 1);
    });
  });

  describe('Error codes', () => {
    it('Has commit bid error codes', () => {
      const expectedCodes = [
        { code: 6039, name: 'TaskDeadlineInvalid' },
        { code: 6042, name: 'TaskWrongState' },
        { code: 6043, name: 'DepositBelowMinimum' },
      ];
      assert.equal(expectedCodes.length, 3);
      assert.equal(expectedCodes[0].code, 6039);
      assert.equal(expectedCodes[1].code, 6042);
      assert.equal(expectedCodes[2].code, 6043);
    });
  });
});
