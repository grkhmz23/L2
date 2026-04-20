/**
 * Sable Private Payments API Adapter
 *
 * HTTP client against MagicBlock's hosted Private Payments API.
 * Builds unsigned SPL token transactions for deposits, transfers, withdrawals,
 * and mint initialization across Solana and MagicBlock ephemeral rollups.
 *
 * Schema modeled from:
 *   https://docs.magicblock.gg/pages/private-ephemeral-rollups-pers/api-reference/per/introduction
 *   Response format documented at payments.magicblock.app/reference
 *
 * In a real deployment, the Private Payments API is hosted by MagicBlock.
 * For local development, use the mock server in services/payments-api-mock/.
 */

import { PublicKey, Transaction, VersionedTransaction } from '@solana/web3.js';
import { BN } from '@coral-xyz/anchor';

export class AmlRejectedError extends Error {
  constructor(public reason: string) {
    super(`AML screening rejected: ${reason}`);
    this.name = 'AmlRejectedError';
  }
}

export class PaymentsApiError extends Error {
  constructor(public status: number, message: string) {
    super(`Payments API error (${status}): ${message}`);
    this.name = 'PaymentsApiError';
  }
}

export interface UnsignedTransactionPayload {
  kind: 'deposit' | 'transfer' | 'withdraw' | 'initMint';
  version: 'legacy' | 'v0';
  transactionBase64: string;
  sendTo: 'base' | 'ephemeral';
  recentBlockhash: string;
  lastValidBlockHeight: number;
  instructionCount: number;
  requiredSigners: string[];
}

export interface SablePaymentsConfig {
  apiUrl: string;
  apiKey?: string;
}

export class SablePayments {
  private apiUrl: string;
  private apiKey?: string;

  constructor(config: SablePaymentsConfig) {
    this.apiUrl = config.apiUrl.replace(/\/$/, '');
    this.apiKey = config.apiKey;
  }

  private async request(path: string, options: RequestInit = {}): Promise<any> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(this.apiKey ? { 'X-API-Key': this.apiKey } : {}),
      ...(options.headers as Record<string, string> || {}),
    };

    const res = await fetch(`${this.apiUrl}${path}`, {
      ...options,
      headers,
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({})) as any;
      throw new PaymentsApiError(res.status, body.error || res.statusText);
    }

    return res.json();
  }

  /**
   * Deserialize an unsigned transaction payload into a Solana Transaction.
   */
  private deserializeTx(payload: UnsignedTransactionPayload): Transaction {
    const txBytes = Buffer.from(payload.transactionBase64, 'base64');

    if (payload.version === 'v0') {
      const vtx = VersionedTransaction.deserialize(txBytes);
      // VersionedTransaction cannot be directly converted to Transaction;
      // callers using v0 should handle it separately. For legacy compatibility
      // we throw so the error is explicit.
      throw new PaymentsApiError(500, 'Versioned transactions (v0) are not yet supported by this adapter');
    }

    return Transaction.from(txBytes);
  }

  /**
   * Build an unsigned deposit transaction from Solana base layer into an ephemeral rollup.
   */
  async buildDeposit({
    from,
    amount,
    mint,
  }: {
    from: PublicKey;
    amount: BN;
    mint?: PublicKey;
  }): Promise<Transaction> {
    const payload: UnsignedTransactionPayload = await this.request('/deposit', {
      method: 'POST',
      body: JSON.stringify({
        from: from.toBase58(),
        amount: amount.toString(),
        mint: mint?.toBase58(),
      }),
    });
    return this.deserializeTx(payload);
  }

  /**
   * Build an unsigned SPL transfer transaction.
   */
  async buildTransfer({
    from,
    to,
    amount,
    mint,
  }: {
    from: PublicKey;
    to: PublicKey;
    amount: BN;
    mint?: PublicKey;
  }): Promise<Transaction> {
    const payload: UnsignedTransactionPayload = await this.request('/transfer', {
      method: 'POST',
      body: JSON.stringify({
        from: from.toBase58(),
        to: to.toBase58(),
        amount: amount.toString(),
        mint: mint?.toBase58(),
      }),
    });
    return this.deserializeTx(payload);
  }

  /**
   * Build an unsigned withdrawal transaction back to Solana base layer.
   */
  async buildWithdraw({
    from,
    to,
    amount,
    mint,
  }: {
    from: PublicKey;
    to: PublicKey;
    amount: BN;
    mint?: PublicKey;
  }): Promise<Transaction> {
    const payload: UnsignedTransactionPayload = await this.request('/withdraw', {
      method: 'POST',
      body: JSON.stringify({
        from: from.toBase58(),
        to: to.toBase58(),
        amount: amount.toString(),
        mint: mint?.toBase58(),
      }),
    });
    return this.deserializeTx(payload);
  }

  /**
   * Get the base-chain SPL token balance for an address.
   */
  async getBalance({
    owner,
    mint,
  }: {
    owner: PublicKey;
    mint?: PublicKey;
  }): Promise<BN> {
    const params = new URLSearchParams();
    params.append('owner', owner.toBase58());
    if (mint) params.append('mint', mint.toBase58());

    const { balance }: { balance: string } = await this.request(`/balance?${params.toString()}`);
    return new BN(balance);
  }

  /**
   * Check whether a mint has a validator-scoped transfer queue on the ephemeral RPC.
   */
  async getMintInitStatus({ mint }: { mint: PublicKey }): Promise<boolean> {
    const { initialized }: { initialized: boolean } = await this.request(
      `/mint-init-status?mint=${mint.toBase58()}`
    );
    return initialized;
  }

  /**
   * Build an unsigned transaction that initializes a validator-scoped transfer queue for a mint.
   */
  async initMint({ mint }: { mint: PublicKey }): Promise<Transaction> {
    const payload: UnsignedTransactionPayload = await this.request('/init-mint', {
      method: 'POST',
      body: JSON.stringify({
        mint: mint.toBase58(),
      }),
    });
    return this.deserializeTx(payload);
  }

  /**
   * AML / compliance screening.
   */
  aml = {
    screen: async ({ address }: { address: string }): Promise<{ ok: boolean; reason?: string }> => {
      const { ok, reason }: { ok: boolean; reason?: string } = await this.request('/aml-screen', {
        method: 'POST',
        body: JSON.stringify({ address }),
      });

      if (!ok) {
        throw new AmlRejectedError(reason || 'Address blocked by compliance screening');
      }

      return { ok, reason };
    },
  };
}
