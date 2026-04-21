import { expect } from 'chai';
import { BN } from '@coral-xyz/anchor';
import { PublicKey } from '@solana/web3.js';
import { setupUser, sleep, getValidatorTime } from './helpers/setup';
import { checkConservation } from './helpers/conservation';

describe('04-auctions', () => {
  let sdk: Awaited<ReturnType<typeof setupUser>>['sdk'];
  let wallet: Awaited<ReturnType<typeof setupUser>>['wallet'];
  let mint: Awaited<ReturnType<typeof setupUser>>['mint'];
  let task: PublicKey;
  let bidders: {
    sdk: Awaited<ReturnType<typeof setupUser>>['sdk'];
    wallet: Awaited<ReturnType<typeof setupUser>>['wallet'];
    amount: number;
    nonce: BN;
  }[] = [];

  before(async () => {
    ({ sdk, wallet, mint } = await setupUser());
    console.log('04-auctions wallet:', wallet.publicKey.toBase58());

    // Create 3 separate bidders (each needs their own UserState + balance)
    for (const amount of [80_000, 70_000, 90_000]) {
      const { sdk: bidderSdk, wallet: bidderWallet } = await setupUser();
      bidders.push({ sdk: bidderSdk, wallet: bidderWallet, amount, nonce: new BN(0) });
    }
  });

  afterEach(async () => {
    await checkConservation();
  });

  it('can create a task', async () => {
    const result = await sdk.auctions.createTask({
      posterKind: 'user',
      poster: wallet.publicKey,
      mint,
      budget: new BN(100_000),
      minDeposit: new BN(1_000),
      specContent: 'Test task for integration',
      bidCommitSeconds: 3,
      bidRevealSeconds: 6,
    });
    task = result.task;
    await sleep(500);

    const info = await sdk.auctions.getTask(task);
    expect(info).to.not.be.null;
    expect(info!.budget.toNumber()).to.equal(100_000);
    expect(info!.state).to.equal('open');
  });

  it('can commit bids', async () => {
    for (let i = 0; i < bidders.length; i++) {
      const bidder = bidders[i];
      console.log(
        'commitBid bidder',
        i,
        bidder.wallet.publicKey.toBase58(),
        'amount',
        bidder.amount
      );
      const result = await bidder.sdk.auctions.commitBid({
        task,
        bidder: bidder.wallet.publicKey,
        bidderKind: 'user',
        amount: new BN(bidder.amount),
        deposit: new BN(1_000),
      });
      bidder.nonce = result.nonce;
      await sleep(200);
    }

    const info = await sdk.auctions.getTask(task);
    expect(info!.bidCount).to.equal(3);
  });

  it('can reveal bids after commit deadline', async () => {
    const info = await sdk.auctions.getTask(task);
    const now = await getValidatorTime();
    const waitUntil = info!.bidCommitDeadline.toNumber() + 1;
    if (now < waitUntil) {
      await sleep((waitUntil - now) * 1000 + 500);
    }

    for (let i = 0; i < bidders.length; i++) {
      const bidder = bidders[i];
      await bidder.sdk.auctions.revealBid({
        task,
        bidder: bidder.wallet.publicKey,
        bidderKind: 'user',
        amount: new BN(bidder.amount),
        nonce: bidder.nonce,
      });
      await sleep(200);
    }
  });

  it('can settle auction after reveal deadline', async () => {
    const info = await sdk.auctions.getTask(task);
    const now = await getValidatorTime();
    const waitUntil = info!.bidRevealDeadline.toNumber() + 1;
    if (now < waitUntil) {
      await sleep((waitUntil - now) * 1000 + 500);
    }

    const result = await sdk.auctions.settleAuction({ task });
    await sleep(500);

    // Lowest bid (70_000) wins
    const winner = bidders.find((b) => b.amount === 70_000)!;
    expect(result.winner.toBase58()).to.equal(winner.wallet.publicKey.toBase58());
    expect(result.winningAmount.toNumber()).to.equal(70_000);

    const updated = await sdk.auctions.getTask(task);
    expect(updated!.state).to.equal('settled');
  });
});
