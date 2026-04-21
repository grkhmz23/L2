import { Keypair, PublicKey, SystemProgram } from '@solana/web3.js';
import { BN } from '@coral-xyz/anchor';
import type { SableClient } from './client';
import { PERMISSION_PROGRAM_ID } from './pda';
import { computeCommitHash, sha256 } from '@sable/common';
import type { TransactionResult } from './types';

export type PosterKind = 'user' | 'agent';
export type BidderKind = 'user' | 'agent';
export type TaskState = 'open' | 'revealing' | 'settled' | 'cancelled';

export interface TaskSnapshot {
  pubkey: PublicKey;
  version: number;
  bump: number;
  poster: PublicKey;
  posterKind: PosterKind;
  mint: PublicKey;
  budget: BN;
  minDeposit: BN;
  specHash: number[];
  bidCommitDeadline: BN;
  bidRevealDeadline: BN;
  state: TaskState;
  winningBidder: PublicKey;
  winningBid: BN;
  bidCount: number;
  taskId: BN;
}

export interface BidSnapshot {
  pubkey: PublicKey;
  version: number;
  bump: number;
  task: PublicKey;
  bidder: PublicKey;
  bidderKind: BidderKind;
  commitHash: number[];
  deposit: BN;
  revealedAmount: BN;
  revealed: boolean;
  submittedAt: BN;
}

function toPosterKindEnum(kind: PosterKind): any {
  return kind === 'user' ? { user: {} } : { agent: {} };
}

function toBidderKindEnum(kind: BidderKind): any {
  return kind === 'user' ? { user: {} } : { agent: {} };
}

function parseTaskState(state: any): TaskState {
  if (state.open !== undefined) return 'open';
  if (state.revealing !== undefined) return 'revealing';
  if (state.settled !== undefined) return 'settled';
  return 'cancelled';
}

/** Convert camelCase keys to snake_case recursively (Anchor 0.32 returns camelCase) */
function toSnakeCase(obj: any): any {
  if (obj instanceof PublicKey || obj instanceof BN) return obj;
  if (Array.isArray(obj)) return obj.map(toSnakeCase);
  if (typeof obj === 'object' && obj !== null) {
    const result: any = {};
    for (const [key, value] of Object.entries(obj)) {
      const snake = key.replace(/[A-Z]/g, (c) => '_' + c.toLowerCase());
      result[snake] = toSnakeCase(value);
    }
    return result;
  }
  return obj;
}

function parseTaskAccount(pubkey: PublicKey, data: any): TaskSnapshot {
  const d = toSnakeCase(data);
  return {
    pubkey,
    version: d.version,
    bump: d.bump,
    poster: d.poster,
    posterKind: d.poster_kind?.user !== undefined ? 'user' : 'agent',
    mint: d.mint,
    budget: d.budget,
    minDeposit: d.min_deposit,
    specHash: d.spec_hash,
    bidCommitDeadline: d.bid_commit_deadline,
    bidRevealDeadline: d.bid_reveal_deadline,
    state: parseTaskState(d.state),
    winningBidder: d.winning_bidder,
    winningBid: d.winning_bid,
    bidCount: d.bid_count,
    taskId: d.task_id,
  };
}

function parseBidAccount(pubkey: PublicKey, data: any): BidSnapshot {
  const d = toSnakeCase(data);
  return {
    pubkey,
    version: d.version,
    bump: d.bump,
    task: d.task,
    bidder: d.bidder,
    bidderKind: d.bidder_kind?.user !== undefined ? 'user' : 'agent',
    commitHash: d.commit_hash,
    deposit: d.deposit,
    revealedAmount: d.revealed_amount,
    revealed: d.revealed,
    submittedAt: d.submitted_at,
  };
}

function asRemainingAccounts(
  pubkeys: PublicKey[],
  isWritable = false
): { pubkey: PublicKey; isWritable: boolean; isSigner: boolean }[] {
  return pubkeys.map((pk) => ({
    pubkey: pk,
    isWritable,
    isSigner: false,
  }));
}

/** Generate a cryptographically random u64 nonce */
function generateNonce(): BN {
  const bytes = new Uint8Array(8);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    // Node fallback
    const nodeCrypto = require('crypto');
    nodeCrypto.randomFillSync(bytes);
  }
  return new BN(bytes, 'le');
}

export class AuctionsModule {
  constructor(private client: SableClient) {}

  // ─── Helpers ────────────────────────────────────────────────

  private async buildAncestorChainForAuth(
    agent: PublicKey
  ): Promise<PublicKey[]> {
    const chain: PublicKey[] = [];
    let currentPk = agent;

    const visited = new Set<string>();
    while (true) {
      const key = currentPk.toBase58();
      if (visited.has(key)) throw new Error('Cycle detected in ancestor chain');
      visited.add(key);

      const data = (await this.client.program.account.agentState.fetch(currentPk)) as any;

      if (data.parentKind?.user !== undefined) {
        break;
      }

      chain.push(data.parent as PublicKey);
      currentPk = data.parent as PublicKey;
    }

    return chain;
  }

  // ─── Task Lifecycle ─────────────────────────────────────────

  /**
   * Create a new task (auction listing).
   * The specContent is hashed with SHA-256 client-side.
   * Deadlines are computed as offsets from the current block time.
   */
  async createTask({
    posterKind,
    poster,
    mint,
    budget,
    minDeposit,
    specContent,
    bidCommitSeconds,
    bidRevealSeconds,
  }: {
    posterKind: PosterKind;
    poster: PublicKey;
    mint: PublicKey;
    budget: BN;
    minDeposit: BN;
    specContent: string;
    bidCommitSeconds: number;
    bidRevealSeconds: number;
  }): Promise<{ task: PublicKey; tx: TransactionResult }> {
    if (!this.client.isConnected) throw new Error('Wallet not connected');

    const posterOwner = this.client.walletPublicKey!;

    // Resolve poster PDA: when posterKind is 'user', caller passes owner pubkey;
    // we need the UserState PDA for accounts and PDA derivation.
    const posterPda =
      posterKind === 'user'
        ? this.client.pda.deriveUserState(poster)[0]
        : poster;

    let taskId: number;
    if (posterKind === 'user') {
      console.log('createTask posterPda:', posterPda.toBase58());
      const userState = await this.client.program.account.userState.fetch(posterPda);
      console.log('createTask userState fetched:', userState);
      taskId = userState.taskCount;
    } else {
      const agentState = await this.client.program.account.agentState.fetch(posterPda);
      taskId = agentState.taskCount;
    }

    const [task] = this.client.pda.deriveTask(posterPda, taskId);
    const [taskEscrow] = this.client.pda.deriveTaskEscrow(task);
    const [permission] = this.client.pda.derivePermission(taskEscrow);

    // Derive poster balance
    let posterBalance: PublicKey;
    if (posterKind === 'user') {
      [posterBalance] = this.client.pda.deriveUserBalance(posterOwner, mint);
    } else {
      [posterBalance] = this.client.pda.deriveAgentBalance(poster, mint);
    }

    // Compute deadlines from current time
    const now = Math.floor(Date.now() / 1000);
    const bidCommitDeadline = now + bidCommitSeconds;
    const bidRevealDeadline = now + bidRevealSeconds;

    if (bidRevealDeadline <= bidCommitDeadline) {
      throw new Error('bidRevealSeconds must be > bidCommitSeconds');
    }
    if (bidRevealDeadline > now + 7 * 86400) {
      throw new Error('Reveal deadline must be within 7 days');
    }

    // Hash spec content
    const specHash = sha256(new TextEncoder().encode(specContent));

    // Build ancestor chain for agent poster
    let remainingAccounts: { pubkey: PublicKey; isWritable: boolean; isSigner: boolean }[] = [];
    let agentCounters: PublicKey = Keypair.generate().publicKey; // dummy for user posters (unused by program)
    if (posterKind === 'agent') {
      const ancestors = await this.buildAncestorChainForAuth(posterPda);
      remainingAccounts = asRemainingAccounts(ancestors);
      [agentCounters] = this.client.pda.deriveAgentCounters(posterPda);
    }

    const tx = await this.client.program.methods
      .createTask(
        toPosterKindEnum(posterKind),
        new BN(taskId),
        budget,
        minDeposit,
        Array.from(specHash),
        new BN(bidCommitDeadline),
        new BN(bidRevealDeadline)
      )
      .accounts({
        posterOwner,
        poster: posterPda,
        posterBalance,
        task,
        taskEscrow,
        mint,
        agentCounters,
        systemProgram: SystemProgram.programId,
        permissionProgram: PERMISSION_PROGRAM_ID,
        permission,
      })
      .remainingAccounts(remainingAccounts)
      .transaction();

    const result = await this.client.sendTransaction(tx);
    return { task, tx: result };
  }

  /**
   * Cancel a task and refund escrowed budget.
   * Only callable if state == Open, now < bid_commit_deadline, bid_count == 0.
   */
  async cancelTask({
    task,
  }: {
    task: PublicKey;
  }): Promise<{ tx: TransactionResult }> {
    if (!this.client.isConnected) throw new Error('Wallet not connected');

    const signer = this.client.walletPublicKey!;

    const taskData = (await this.client.program.account.task.fetch(task)) as any;
    const [taskEscrow] = this.client.pda.deriveTaskEscrow(task);

    let posterBalance: PublicKey;
    if (taskData.posterKind?.user !== undefined) {
      const [userState] = this.client.pda.deriveUserState(signer);
      [posterBalance] = this.client.pda.deriveUserBalance(signer, taskData.mint as PublicKey);
    } else {
      [posterBalance] = this.client.pda.deriveAgentBalance(
        taskData.poster as PublicKey,
        taskData.mint as PublicKey
      );
    }

    const tx = await this.client.program.methods
      .cancelTask()
      .accounts({
        signer,
        task,
        taskEscrow,
        poster: taskData.poster as PublicKey,
        posterBalance,
      })
      .transaction();

    const result = await this.client.sendTransaction(tx);
    return { tx: result };
  }

  // ─── Bid Lifecycle ──────────────────────────────────────────

  /**
   * Commit a sealed bid to a task.
   * Generates a random nonce, computes the keccak256 commit hash,
   * and submits it on-chain. Returns the nonce and hash — caller MUST persist
   * the nonce or reveal will be impossible.
   */
  async commitBid({
    task,
    bidder,
    bidderKind,
    amount,
    deposit,
    nonce: providedNonce,
  }: {
    task: PublicKey;
    bidder: PublicKey;
    bidderKind: BidderKind;
    amount: BN;
    deposit: BN;
    nonce?: BN; // optional: caller can provide their own nonce
  }): Promise<{ tx: TransactionResult; nonce: BN; commitHash: Uint8Array }> {
    if (!this.client.isConnected) throw new Error('Wallet not connected');

    const bidderOwner = this.client.walletPublicKey!;

    // Resolve bidder PDA: user bidder passes owner pubkey, we need UserState PDA
    const bidderPda =
      bidderKind === 'user'
        ? this.client.pda.deriveUserState(bidder)[0]
        : bidder;

    const [bid] = this.client.pda.deriveBid(task, bidderPda);

    const taskData = (await this.client.program.account.task.fetch(task)) as any;
    const mint = taskData.mint as PublicKey;
    const [taskEscrow] = this.client.pda.deriveTaskEscrow(task);

    // Derive bidder balance
    let bidderBalance: PublicKey;
    if (bidderKind === 'user') {
      [bidderBalance] = this.client.pda.deriveUserBalance(bidderOwner, mint);
    } else {
      [bidderBalance] = this.client.pda.deriveAgentBalance(bidder, mint);
    }

    // Generate or use provided nonce
    const nonce = providedNonce ?? generateNonce();

    // Compute commit hash using bidderPda (UserState/AgentState PDA) —
    // the program stores bid.bidder = bidderPda and reveal verifies against it.
    const commitHash = computeCommitHash(amount, nonce, bidderPda);

    // Build ancestor chain for agent bidder
    let remainingAccounts: { pubkey: PublicKey; isWritable: boolean; isSigner: boolean }[] = [];
    let agentCounters: PublicKey = Keypair.generate().publicKey; // dummy for user bidders (unused by program)
    if (bidderKind === 'agent') {
      const ancestors = await this.buildAncestorChainForAuth(bidder);
      remainingAccounts = asRemainingAccounts(ancestors);
      [agentCounters] = this.client.pda.deriveAgentCounters(bidder);
    }

    const tx = await this.client.program.methods
      .commitBid(toBidderKindEnum(bidderKind), Array.from(commitHash), deposit)
      .accounts({
        bidderOwner,
        bidder: bidderPda,
        bidderBalance,
        task,
        taskEscrow,
        bid,
        mint,
        agentCounters,
        systemProgram: SystemProgram.programId,
      })
      .remainingAccounts(remainingAccounts)
      .transaction();

    console.log('commitBid bidder:', bidder.toBase58(), 'bidderPda:', bidderPda.toBase58());
    console.log('commitBid tx instructions:', tx.instructions.length);
    tx.instructions.forEach((ix: any, i: number) => {
      console.log('Instruction', i, 'program:', ix.programId.toBase58());
      ix.keys.forEach((k: any, j: number) => console.log('  key', j, k.pubkey.toBase58(), 'writable:', k.isWritable, 'signer:', k.isSigner));
    });

    const result = await this.client.sendTransaction(tx);
    return { tx: result, nonce, commitHash };
  }

  /**
   * Reveal a sealed bid during the reveal window.
   */
  async revealBid({
    task,
    bidder,
    bidderKind = 'user',
    amount,
    nonce,
  }: {
    task: PublicKey;
    bidder: PublicKey;
    bidderKind?: BidderKind;
    amount: BN;
    nonce: BN;
  }): Promise<{ tx: TransactionResult }> {
    if (!this.client.isConnected) throw new Error('Wallet not connected');

    const bidderOwner = this.client.walletPublicKey!;
    const bidderPda =
      bidderKind === 'user'
        ? this.client.pda.deriveUserState(bidder)[0]
        : bidder;
    const [bid] = this.client.pda.deriveBid(task, bidderPda);

    const tx = await this.client.program.methods
      .revealBid(amount, nonce)
      .accounts({
        bidderOwner,
        bidder: bidderPda,
        bid,
        task,
      })
      .transaction();

    const result = await this.client.sendTransaction(tx);
    return { tx: result };
  }

  /**
   * Settle the auction after the reveal deadline.
   * Callable by anyone (crank-friendly).
   * Returns the winner pubkey and winning amount.
   */
  async settleAuction({
    task,
  }: {
    task: PublicKey;
  }): Promise<{
    tx: TransactionResult;
    winner: PublicKey;
    winningAmount: BN;
  }> {
    if (!this.client.isConnected) throw new Error('Wallet not connected');

    const caller = this.client.walletPublicKey!;
    const [taskEscrow] = this.client.pda.deriveTaskEscrow(task);

    const taskData = (await this.client.program.account.task.fetch(task)) as any;

    // Derive poster balance for refund
    let posterBalance: PublicKey;
    if (taskData.posterKind?.user !== undefined) {
      // User poster
      const poster = taskData.poster as PublicKey;
      const posterAccount = await this.client.config.connection.getAccountInfo(poster);
      if (!posterAccount) {
        throw new Error('Poster account not found');
      }
      // Read owner from UserState
      const ownerBytes = posterAccount.data.slice(8, 40); // after discriminator
      const owner = new PublicKey(ownerBytes);
      [posterBalance] = this.client.pda.deriveUserBalance(owner, taskData.mint as PublicKey);
    } else {
      // Agent poster
      [posterBalance] = this.client.pda.deriveAgentBalance(
        taskData.poster as PublicKey,
        taskData.mint as PublicKey
      );
    }

    // Fetch all bids and build remaining accounts
    const bids = await this.getTaskBids(task);
    const remainingAccounts: { pubkey: PublicKey; isWritable: boolean; isSigner: boolean }[] = [];
    for (const bid of bids) {
      const bidderPda = bid.bidder;
      const [bidPda] = this.client.pda.deriveBid(task, bidderPda);
      let balancePda: PublicKey;
      if (bid.bidderKind === 'user') {
        // For user bidders, read owner from UserState (bidderPda is the UserState PDA)
        const bidderAccount = await this.client.config.connection.getAccountInfo(bidderPda);
        if (!bidderAccount) {
          throw new Error('Bidder account not found');
        }
        const ownerBytes = bidderAccount.data.slice(8, 40); // after discriminator
        const owner = new PublicKey(ownerBytes);
        [balancePda] = this.client.pda.deriveUserBalance(owner, taskData.mint as PublicKey);
      } else {
        [balancePda] = this.client.pda.deriveAgentBalance(bidderPda, taskData.mint as PublicKey);
      }
      remainingAccounts.push(
        { pubkey: bidPda, isWritable: true, isSigner: false },
        { pubkey: balancePda, isWritable: true, isSigner: false }
      );
    }

    const tx = await this.client.program.methods
      .settleAuction()
      .accounts({
        caller,
        task,
        taskEscrow,
        posterBalance,
      })
      .remainingAccounts(remainingAccounts)
      .transaction();

    const result = await this.client.sendTransaction(tx);

    // Fetch updated task to get winner
    const updatedTask = (await this.client.program.account.task.fetch(task)) as any;
    return {
      tx: result,
      winner: updatedTask.winningBidder as PublicKey,
      winningAmount: updatedTask.winningBid as BN,
    };
  }

  // ─── Queries ────────────────────────────────────────────────

  /**
   * Get a single task by pubkey.
   */
  async getTask(task: PublicKey): Promise<TaskSnapshot | null> {
    try {
      const data = (await this.client.program.account.task.fetch(task)) as any;
      return parseTaskAccount(task, data);
    } catch {
      return null;
    }
  }

  /**
   * Get a single bid by task + bidder.
   */
  async getBid(task: PublicKey, bidder: PublicKey): Promise<BidSnapshot | null> {
    const [bidPda] = this.client.pda.deriveBid(task, bidder);
    try {
      const data = (await this.client.program.account.bid.fetch(bidPda)) as any;
      return parseBidAccount(bidPda, data);
    } catch {
      return null;
    }
  }

  /**
   * List all bids for a given task.
   */
  async getTaskBids(task: PublicKey): Promise<BidSnapshot[]> {
    const accounts = await this.client.program.account.bid.all();
    return accounts
      .filter((a: any) => {
        const d = toSnakeCase(a.account);
        return d.task?.toBase58() === task.toBase58();
      })
      .map((a: any) => parseBidAccount(a.publicKey, a.account));
  }

  /**
   * List tasks with optional filters.
   */
  async listTasks({
    poster,
    state,
  }: {
    poster?: PublicKey;
    state?: TaskState;
  } = {}): Promise<TaskSnapshot[]> {
    const accounts = await this.client.program.account.task.all();
    let tasks = accounts.map((a: any) => parseTaskAccount(a.publicKey, a.account));

    if (poster) {
      tasks = tasks.filter((t: TaskSnapshot) => t.poster.toBase58() === poster.toBase58());
    }

    if (state) {
      tasks = tasks.filter((t: TaskSnapshot) => t.state === state);
    }

    return tasks;
  }
}
