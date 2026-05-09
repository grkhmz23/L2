'use client';

import { PublicKey } from '@solana/web3.js';
import type { SableSdk, TransferItem as SdkTransferItem } from '@sable/sdk';
import { BN } from '@coral-xyz/anchor';
import type { Connection } from '@solana/web3.js';
import { getMintDecimals, parseTokenAmount } from '@/utils/amount';
import type { AgentExecutionResult, AgentProposal, AgentToolContext } from './types';

export interface ExecuteAgentPlanParams {
  proposal: AgentProposal;
  context: AgentToolContext;
  sdk: SableSdk | null;
  solanaSdk: SableSdk | null;
  solanaConnection: Connection;
  userApproved: boolean;
}

export async function executeAgentPlan({
  proposal,
  context,
  sdk,
  solanaSdk,
  solanaConnection,
  userApproved,
}: ExecuteAgentPlanParams): Promise<AgentExecutionResult> {
  if (!userApproved) {
    throw new Error('Safety guard: userApproved=true is required before execution.');
  }
  if (proposal.blocked) {
    throw new Error(proposal.prerequisites[0] || 'Proposal is blocked.');
  }
  if (!sdk) throw new Error('Wallet SDK is unavailable. Connect your wallet.');

  const plan = proposal.plan;
  const l1Sdk = solanaSdk || sdk;

  switch (plan.actionType) {
    case 'CREATE_TREASURY': {
      const result = await sdk.join();
      return success(plan.actionType, result.signature, 'Treasury created.');
    }
    case 'COMPLETE_SETUP': {
      const result = await sdk.completeSetup([]);
      return success(plan.actionType, result.signature, 'Setup completed with default wSOL.');
    }
    case 'ADD_WS0L_BALANCE': {
      const result = await sdk.addMint(new PublicKey(context.wsolMint));
      return success(plan.actionType, result.signature, 'wSOL balance added.');
    }
    case 'ADD_MINT': {
      if (!plan.mint) throw new Error('Mint is required.');
      const result = await sdk.addMint(new PublicKey(plan.mint));
      return success(plan.actionType, result.signature, 'Mint added.');
    }
    case 'DEPOSIT': {
      const mint = requireMint(plan.mint);
      const amount = await parseUiAmount(solanaConnection, mint, plan.amount);
      const result = await sdk.deposit({ mint, amount });
      return success(plan.actionType, result.signature, 'Deposit submitted.');
    }
    case 'INTERNAL_TRANSFER':
    case 'BATCH_TRANSFER': {
      const mint = requireMint(plan.mint);
      const items = await buildTransferItems(solanaConnection, mint, plan.recipients || []);
      const results = await sdk.transferBatchChunked(mint, items, 15);
      return {
        ok: true,
        actionType: plan.actionType,
        signatures: results.map((r) => r.signature),
        message: `Prepared transfer signed in ${results.length} transaction(s).`,
      };
    }
    case 'EXTERNAL_SEND': {
      const mint = requireMint(plan.mint);
      const items = await buildTransferItems(solanaConnection, mint, plan.recipients || []);
      const results = await l1Sdk.externalSendBatchChunked(mint, items, 12);
      return {
        ok: true,
        actionType: plan.actionType,
        signatures: results.map((r) => r.signature),
        message: `External vault send signed in ${results.length} transaction(s).`,
      };
    }
    case 'DELEGATE': {
      const mints = plan.mint ? [new PublicKey(plan.mint)] : context.knownMints.map((m) => new PublicKey(m.mint));
      if (mints.length === 0) throw new Error('No tracked mints to delegate.');
      const result = await l1Sdk.delegate({ mintList: mints });
      return success(plan.actionType, result.signature, 'Delegation requested.');
    }
    case 'COMMIT_UNDELEGATE': {
      const mints = plan.mint ? [new PublicKey(plan.mint)] : context.knownMints.map((m) => new PublicKey(m.mint));
      if (mints.length === 0) throw new Error('No tracked mints to commit / undelegate.');
      await sdk.closeSession().catch(() => undefined);
      const result = await l1Sdk.commitAndUndelegate({ mintList: mints });
      return success(plan.actionType, result.signature, 'Commit / undelegate requested.');
    }
    case 'WITHDRAW': {
      const mint = requireMint(plan.mint);
      const amount = await parseUiAmount(solanaConnection, mint, plan.amount);
      const result = await l1Sdk.withdraw({
        mint,
        amount,
        destinationAta: plan.destinationAta ? new PublicKey(plan.destinationAta) : undefined,
      });
      return success(plan.actionType, result.signature, 'Withdrawal submitted.');
    }
    case 'EXPLAIN_BALANCES':
      return { ok: true, actionType: plan.actionType, message: explainBalances(context) };
    case 'SHOW_SETTINGS':
      return { ok: true, actionType: plan.actionType, message: explainSettings(context) };
    default:
      throw new Error('Unknown action cannot be executed.');
  }
}

function requireMint(mint?: string) {
  if (!mint) throw new Error('Mint is required.');
  return new PublicKey(mint);
}

async function parseUiAmount(connection: Connection, mint: PublicKey, amount?: string): Promise<BN> {
  if (!amount) throw new Error('Amount is required.');
  return parseTokenAmount(amount, await getMintDecimals(connection, mint));
}

async function buildTransferItems(connection: Connection, mint: PublicKey, recipients: Array<{ address: string; amount?: string }>) {
  if (recipients.length === 0) throw new Error('At least one recipient is required.');
  const decimals = await getMintDecimals(connection, mint);
  const items: SdkTransferItem[] = recipients.map((recipient) => {
    if (!recipient.amount) throw new Error(`Amount missing for ${recipient.address}`);
    return {
      toOwner: new PublicKey(recipient.address),
      amount: parseTokenAmount(recipient.amount, decimals),
      kind: 'user' as const,
    };
  });
  return items;
}

function success(actionType: AgentExecutionResult['actionType'], signature: string, message: string): AgentExecutionResult {
  return { ok: true, actionType, signature, message };
}

function explainBalances(context: AgentToolContext) {
  if (context.knownMints.length === 0) {
    return context.userStateExists
      ? 'Treasury exists, but no tracked balances were found. Add USDC, wSOL, or another mint first.'
      : 'No treasury was found for this wallet. Create your treasury first.';
  }
  return context.knownMints
    .map((m) => `${m.symbol}: ${m.balanceRaw || '0'} raw units${m.isDelegated ? ' (delegated)' : ''}`)
    .join('\n');
}

function explainSettings(context: AgentToolContext) {
  return [
    `Program: ${context.settings.programId}`,
    `Solana RPC: ${context.settings.solanaRpcUrl}`,
    `Magic Router: ${context.settings.magicRouterUrl}`,
    `Payments API configured: ${context.settings.paymentsApiConfigured ? 'yes' : 'no'}`,
    `PER configured: ${context.settings.perConfigured ? 'yes' : 'no'}`,
  ].join('\n');
}
