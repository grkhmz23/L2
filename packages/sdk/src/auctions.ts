import { PublicKey, SystemProgram } from '@solana/web3.js';
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

function parseTaskAccount(pubkey: PublicKey, data: any): TaskSnapshot {
  return {
    pubkey,
    version: data.version,
    bump: data.bump,
    poster: data.poster,
    posterKind: data.poster_kind?.user !== undefined ? 'user' : 'agent',
    mint: data.mint,
    budget: data.budget,
    minDeposit: data.min_deposit,
    specHash: data.spec_hash,
    bidCommitDeadline: data.bid_commit_deadline,
    bidRevealDeadline: data.bid_reveal_deadline,
    state: parseTaskState(data.state),
    winningBidder: data.winning_bidder,
    winningBid: data.winning_bid,
    bidCount: data.bid_count,
    taskId: data.task_id,
  };
}

function parseBidAccount(pubkey: PublicKey, data: any): BidSnapshot {
  return {
    pubkey,
    version: data.version,
    bump: data.bump,
    task: data.task,
    bidder: data.bidder,
    bidderKind: data.bidder_kind?.user !== undefined ? 'user' : 'agent',
    commitHash: data.commit_hash,
    deposit: data.deposit,
    revealedAmount: data.revealed_amount,
    revealed: data.revealed,
    submittedAt: data.submitted_at,
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

      if (data.parent_kind?.user !== undefined) {
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

    // Fetch poster to get current task_count
    const posterAccount = await this.client.config.connection.getAccountInfo(poster);
    if (!posterAccount) {
      throw new Error('Poster account not found');
    }

    let taskId: number;
    if (posterKind === 'user') {
      // UserState: task_count at offset 57 (after agent_count at 49)
      taskId = posterAccount.data.readUInt32LE(57);
    } else {
      // AgentState: task_count at offset 151 (after child_count at 143)
      taskId = posterAccount.data.readUInt32LE(151);
    }

    const [task] = this.client.pda.deriveTask(poster, taskId);
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
    let agentCounters: PublicKey = PublicKey.default;
    if (posterKind === 'agent') {
      const ancestors = await this.buildAncestorChainForAuth(poster);
      remainingAccounts = asRemainingAccounts(ancestors);
      [agentCounters] = this.client.pda.deriveAgentCounters(poster);
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
        poster,
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
    if (taskData.poster_kind?.user !== undefined) {
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
    const [bid] = this.client.pda.deriveBid(task, bidder);

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

    // Compute commit hash
    const commitHash = computeCommitHash(amount, nonce, bidder);

    // Build ancestor chain for agent bidder
    let remainingAccounts: { pubkey: PublicKey; isWritable: boolean; isSigner: boolean }[] = [];
    let agentCounters: PublicKey = PublicKey.default;
    if (bidderKind === 'agent') {
      const ancestors = await this.buildAncestorChainForAuth(bidder);
      remainingAccounts = asRemainingAccounts(ancestors);
      [agentCounters] = this.client.pda.deriveAgentCounters(bidder);
    }

    const tx = await this.client.program.methods
      .commitBid(toBidderKindEnum(bidderKind), Array.from(commitHash), deposit)
      .accounts({
        bidderOwner,
        bidder,
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

    const result = await this.client.sendTransaction(tx);
    return { tx: result, nonce, commitHash };
  }

  /**
   * Reveal a sealed bid during the reveal window.
   */
  async revealBid({
    task,
    bidder,
    amount,
    nonce,
  }: {
    task: PublicKey;
    bidder: PublicKey;
    amount: BN;
    nonce: BN;
  }): Promise<{ tx: TransactionResult }> {
    if (!this.client.isConnected) throw new Error('Wallet not connected');

    const bidderOwner = this.client.walletPublicKey!;
    const [bid] = this.client.pda.deriveBid(task, bidder);

    const tx = await this.client.program.methods
      .revealBid(amount, nonce)
      .accounts({
        bidderOwner,
        bidder,
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
    if (taskData.poster_kind?.user !== undefined) {
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

    const tx = await this.client.program.methods
      .settleAuction()
      .accounts({
        caller,
        task,
        taskEscrow,
        posterBalance,
      })
      .transaction();

    const result = await this.client.sendTransaction(tx);

    // Fetch updated task to get winner
    const updatedTask = (await this.client.program.account.task.fetch(task)) as any;
    return {
      tx: result,
      winner: updatedTask.winning_bidder as PublicKey,
      winningAmount: updatedTask.winning_bid as BN,
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
    const accounts = await this.client.program.account.bid.all([
      {
        memcmp: {
          offset: 8 + 1 + 1, // Skip disc + version + bump
          bytes: task.toBase58(),
        },
      },
    ]);

    return accounts.map((a: any) => parseBidAccount(a.publicKey, a.account));
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
    const filters: any[] = [];

    if (poster) {
      filters.push({
        memcmp: {
          offset: 8 + 1 + 1, // Skip disc + version + bump
          bytes: poster.toBase58(),
        },
      });
    }

    if (state) {
      // TaskState enum: Open=0, Revealing=1, Settled=2, Cancelled=3
      const stateByte =
        state === 'open' ? 0 : state === 'revealing' ? 1 : state === 'settled' ? 2 : 3;
      filters.push({
        memcmp: {
          offset: 8 + 1 + 1 + 32 + 1 + 32 + 8 + 8 + 32 + 8 + 8, // spec_hash + deadlines + state
          bytes: Buffer.from([stateByte]).toString('base64'),
          encoding: 'base64',
        },
      });
    }

    const accounts = await this.client.program.account.task.all(filters);
    return accounts.map((a: any) => parseTaskAccount(a.publicKey, a.account));
  }
}
