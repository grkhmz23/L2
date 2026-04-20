import { PublicKey } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { BN } from '@coral-xyz/anchor';

// Seeds
const CONFIG_SEED = Buffer.from('config');
const USER_STATE_SEED = Buffer.from('user_state');
const AGENT_STATE_SEED = Buffer.from('agent_state');
const AGENT_COUNTERS_SEED = Buffer.from('agent_counters');
const AGENT_BALANCE_SEED = Buffer.from('agent_balance');
const USER_BALANCE_SEED = Buffer.from('user_balance');
const VAULT_AUTHORITY_SEED = Buffer.from('vault_authority');
const TASK_SEED = Buffer.from('task');
const TASK_ESCROW_SEED = Buffer.from('task_escrow');
const BID_SEED = Buffer.from('bid');
const PERMISSION_SEED = Buffer.from('permission:');

// MagicBlock PER permission program
export const PERMISSION_PROGRAM_ID = new PublicKey(
  'ACLseoPoyC3cBqoUtkbjZ4aDrkurZW86v19pXz2XQnp1'
);

export class PdaHelper {
  constructor(private programId: PublicKey) {}

  /**
   * Derive Config PDA
   */
  deriveConfig(): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [CONFIG_SEED],
      this.programId
    );
  }

  /**
   * Derive Permission PDA for a given permissioned account
   */
  derivePermission(permissionedAccount: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [PERMISSION_SEED, permissionedAccount.toBuffer()],
      PERMISSION_PROGRAM_ID
    );
  }

  /**
   * Derive Vault Authority PDA
   */
  deriveVaultAuthority(): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [VAULT_AUTHORITY_SEED],
      this.programId
    );
  }

  /**
   * Derive UserState PDA for a given owner
   */
  deriveUserState(owner: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [USER_STATE_SEED, owner.toBuffer()],
      this.programId
    );
  }

  /**
   * Derive AgentState PDA for a given parent and nonce
   */
  deriveAgentState(parent: PublicKey, nonce: number): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [
        AGENT_STATE_SEED,
        parent.toBuffer(),
        Buffer.from(new Uint32Array([nonce]).buffer),
      ],
      this.programId
    );
  }

  /**
   * Derive AgentCounters PDA for a given agent
   */
  deriveAgentCounters(agent: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [AGENT_COUNTERS_SEED, agent.toBuffer()],
      this.programId
    );
  }

  /**
   * Derive AgentBalance PDA for a given agent and mint
   */
  deriveAgentBalance(agent: PublicKey, mint: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [AGENT_BALANCE_SEED, agent.toBuffer(), mint.toBuffer()],
      this.programId
    );
  }

  /**
   * Derive UserBalance PDA for a given owner and mint
   */
  deriveUserBalance(owner: PublicKey, mint: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [
        USER_BALANCE_SEED,
        owner.toBuffer(),
        mint.toBuffer(),
      ],
      this.programId
    );
  }

  /**
   * Derive Vault ATA for a given mint
   */
  deriveVaultAta(mint: PublicKey, vaultAuthority: PublicKey): PublicKey {
    return PublicKey.findProgramAddressSync(
      [
        vaultAuthority.toBuffer(),
        TOKEN_PROGRAM_ID.toBuffer(),
        mint.toBuffer(),
      ],
      ASSOCIATED_TOKEN_PROGRAM_ID
    )[0];
  }

  /**
   * Derive User ATA for a given owner and mint
   */
  deriveUserAta(owner: PublicKey, mint: PublicKey): PublicKey {
    return PublicKey.findProgramAddressSync(
      [
        owner.toBuffer(),
        TOKEN_PROGRAM_ID.toBuffer(),
        mint.toBuffer(),
      ],
      ASSOCIATED_TOKEN_PROGRAM_ID
    )[0];
  }

  /**
   * Derive Task PDA for a given poster and task_id
   */
  deriveTask(poster: PublicKey, taskId: number | BN): [PublicKey, number] {
    const taskIdBn = taskId instanceof BN ? taskId : new BN(taskId);
    const taskIdBytes = taskIdBn.toArray('le', 8);
    return PublicKey.findProgramAddressSync(
      [TASK_SEED, poster.toBuffer(), Buffer.from(taskIdBytes)],
      this.programId
    );
  }

  /**
   * Derive TaskEscrow PDA for a given task
   */
  deriveTaskEscrow(task: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [TASK_ESCROW_SEED, task.toBuffer()],
      this.programId
    );
  }

  /**
   * Derive Bid PDA for a given task and bidder
   */
  deriveBid(task: PublicKey, bidder: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [BID_SEED, task.toBuffer(), bidder.toBuffer()],
      this.programId
    );
  }

  /**
   * Get all PDAs for a user and mint in one call
   */
  getAllPdas(owner: PublicKey, mint: PublicKey) {
    const [userState, userStateBump] = this.deriveUserState(owner);
    const [userBalance, userBalanceBump] = this.deriveUserBalance(owner, mint);
    const [vaultAuthority, vaultAuthorityBump] = this.deriveVaultAuthority();
    const vaultAta = this.deriveVaultAta(mint, vaultAuthority);

    return {
      userState,
      userStateBump,
      userBalance,
      userBalanceBump,
      vaultAuthority,
      vaultAuthorityBump,
      vaultAta,
      userAta: this.deriveUserAta(owner, mint),
    };
  }
}
