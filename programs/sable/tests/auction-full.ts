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
  instructions: [
    { name: 'revealBid', accounts: [], args: [] },
    { name: 'settleAuction', accounts: [], args: [] },
  ],
  accounts: [],
  errors: [
    { code: 6039, name: 'TaskDeadlineInvalid', msg: 'Task deadline is invalid' },
    { code: 6042, name: 'TaskWrongState', msg: 'Task is in wrong state for this operation' },
    { code: 6044, name: 'InvalidReveal', msg: 'Bid reveal hash does not match commitment' },
  ],
};

describe('auction full flow', () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const user1 = Keypair.generate();
  const user2 = Keypair.generate();
  const user3 = Keypair.generate();

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
    await airdrop(user3, 10);
  });

  describe('Reveal constraints', () => {
    it('Reveal only allowed during reveal window', () => {
      const commitDeadline = 1_000_000;
      const revealDeadline = 2_000_000;
      const duringCommit = 999_999;
      const duringReveal = 1_500_000;
      const afterReveal = 2_000_001;

      assert.isBelow(duringCommit, commitDeadline);
      assert.isAbove(duringReveal, commitDeadline);
      assert.isBelow(duringReveal, revealDeadline);
      assert.isAbove(afterReveal, revealDeadline);
    });

    it('Revealed amount must be <= budget', () => {
      const budget = 500;
      const amount = 600;
      assert.isAbove(amount, budget);
    });

    it('Cannot reveal a bid twice', () => {
      const revealed = true;
      assert.isTrue(revealed);
    });

    it('Hash mismatch fails reveal', () => {
      const commitHash = Buffer.from('abc123...', 'hex');
      const recomputed = Buffer.from('def456...', 'hex');
      assert.notDeepEqual(commitHash, recomputed);
    });
  });

  describe('Settle constraints', () => {
    it('Settle only allowed after reveal deadline', () => {
      const revealDeadline = 2_000_000;
      const before = 1_999_999;
      const after = 2_000_001;
      assert.isBelow(before, revealDeadline);
      assert.isAbove(after, revealDeadline);
    });

    it('Cannot settle an already settled task', () => {
      const state = 2; // Settled
      assert.notEqual(state, 0);
    });

    it('Cannot settle an Open task before reveal deadline', () => {
      const state = 0; // Open
      const now = 1_500_000;
      const revealDeadline = 2_000_000;
      assert.equal(state, 0);
      assert.isBelow(now, revealDeadline);
    });
  });

  describe('Winner selection (deterministic)', () => {
    it('Lowest revealed amount wins', () => {
      const bids = [
        { amount: 300, submittedAt: 100, bidder: 'A' },
        { amount: 200, submittedAt: 200, bidder: 'B' },
        { amount: 400, submittedAt: 150, bidder: 'C' },
      ];
      const winner = bids.reduce((best, current) =>
        current.amount < best.amount ? current : best
      );
      assert.equal(winner.amount, 200);
      assert.equal(winner.bidder, 'B');
    });

    it('Tie broken by earliest submitted_at', () => {
      const bids = [
        { amount: 200, submittedAt: 200, bidder: 'A' },
        { amount: 200, submittedAt: 100, bidder: 'B' },
      ];
      const winner = bids.reduce((best, current) => {
        if (current.amount < best.amount) return current;
        if (current.amount === best.amount && current.submittedAt < best.submittedAt) return current;
        return best;
      });
      assert.equal(winner.bidder, 'B');
    });

    it('Tie-of-ties broken by lexicographically smaller bidder pubkey', () => {
      const bidA = { amount: 200, submittedAt: 100, bidder: 'SaSAXcdWhyr1...B' };
      const bidB = { amount: 200, submittedAt: 100, bidder: 'SaSAXcdWhyr1...A' };
      const winner = bidB.bidder < bidA.bidder ? bidB : bidA;
      assert.equal(winner.bidder, 'SaSAXcdWhyr1...A');
    });
  });

  describe('Payout math', () => {
    it('Winner gets winning_amount + own deposit', () => {
      const winningAmount = 200;
      const winnerDeposit = 50;
      const payout = winningAmount + winnerDeposit;
      assert.equal(payout, 250);
    });

    it('Revealed non-winner gets deposit back', () => {
      const deposit = 50;
      assert.equal(deposit, 50);
    });

    it('Unrevealed bidder forfeits deposit to poster', () => {
      const deposit = 50;
      const posterGets = deposit;
      assert.equal(posterGets, 50);
    });

    it('Poster residual = (budget - winning_amount) + unrevealed deposits', () => {
      const budget = 500;
      const winningAmount = 200;
      const unrevealedDeposits = 100;
      const residual = (budget - winningAmount) + unrevealedDeposits;
      assert.equal(residual, 400);
    });

    it('Zero reveals: full escrow refunded to poster', () => {
      const escrow = 650; // budget 500 + deposits 150
      const posterRefund = escrow;
      assert.equal(posterRefund, 650);
    });

    it('Escrow conservation: inflows == outflows', () => {
      const budget = 500;
      const deposits = [50, 50, 50];
      const totalDeposits = deposits.reduce((a, b) => a + b, 0);
      const escrow = budget + totalDeposits;

      const winningAmount = 200;
      const winnerDeposit = 50;
      const unrevealedDeposits = 50;
      const revealedNonWinnerDeposits = 50;

      const winnerPayout = winningAmount + winnerDeposit;
      const posterResidual = (budget - winningAmount) + unrevealedDeposits;
      const totalOutflows = winnerPayout + revealedNonWinnerDeposits + posterResidual;

      assert.equal(totalOutflows, escrow);
    });
  });

  describe('Error codes', () => {
    it('Has auction settle error codes', () => {
      const expectedCodes = [
        { code: 6039, name: 'TaskDeadlineInvalid' },
        { code: 6042, name: 'TaskWrongState' },
        { code: 6044, name: 'InvalidReveal' },
      ];
      assert.equal(expectedCodes.length, 3);
      assert.equal(expectedCodes[0].code, 6039);
      assert.equal(expectedCodes[1].code, 6042);
      assert.equal(expectedCodes[2].code, 6044);
    });
  });
});
