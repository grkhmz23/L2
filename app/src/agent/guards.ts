import { PublicKey } from '@solana/web3.js';
import type { AgentActionPlan, AgentProposal, AgentRiskLevel, AgentToolContext } from './types';

export function buildAgentProposal(plan: AgentActionPlan, context: AgentToolContext): AgentProposal {
  const prerequisites: string[] = [];
  const warnings = [...plan.warnings];
  const accountsTouched = collectAccounts(plan, context);

  if (plan.requiresTransaction && !context.walletConnected) {
    prerequisites.push('Connect a wallet before preparing a transaction.');
  }
  if (requiresTreasury(plan) && !context.userStateExists) {
    prerequisites.push('Create your Sable treasury first.');
  }
  if (plan.missingFields.length > 0) {
    prerequisites.push(`Missing required field(s): ${plan.missingFields.join(', ')}.`);
  }
  if (plan.amount && !isPositiveAmount(plan.amount)) {
    prerequisites.push('Enter a positive amount.');
  }
  for (const recipient of plan.recipients || []) {
    if (!isValidPublicKey(recipient.address)) {
      prerequisites.push(`Invalid recipient address: ${recipient.address}`);
    }
  }
  if (plan.recipient && !isValidPublicKey(plan.recipient)) {
    prerequisites.push(`Invalid recipient address: ${plan.recipient}`);
  }
  if (plan.mint && !isValidPublicKey(plan.mint)) {
    prerequisites.push(`Invalid mint address: ${plan.mint}`);
  }
  if (plan.destinationAta && !isValidPublicKey(plan.destinationAta)) {
    prerequisites.push('Invalid destination ATA.');
  }
  if ((plan.actionType === 'DELEGATE' || plan.route === 'MagicBlock Router' || plan.route === 'ER') && !context.magicBlockAvailable) {
    prerequisites.push('MagicBlock router/PER configuration is missing.');
  }
  if (plan.actionType === 'WITHDRAW') {
    const mint = plan.mint;
    const delegated = context.knownMints.some((m) => (!mint || m.mint === mint) && m.isDelegated);
    if (delegated) {
      prerequisites.push('This balance appears delegated. Commit / undelegate before withdrawing.');
    }
  }

  if (plan.actionType === 'EXTERNAL_SEND') {
    warnings.push('External vault sends require committed L1 state and recipient token accounts may be created.');
  }
  if (plan.actionType === 'BATCH_TRANSFER') {
    warnings.push('Batch sends may require multiple wallet approvals when chunked.');
  }
  if (plan.requiresTransaction) {
    warnings.push('Sable Agent only prepares this action. Your wallet must approve and sign.');
  }

  const blocked = prerequisites.length > 0 || plan.actionType === 'UNKNOWN';
  const riskLevel = riskForPlan(plan, blocked);

  return {
    id: `${Date.now()}-${plan.actionType}`,
    plan,
    summary: plan.summary,
    route: plan.route || 'Unknown',
    accountsTouched,
    prerequisites,
    warnings,
    riskLevel,
    blocked,
    estimatedNextStep: blocked
      ? 'Resolve prerequisites, then ask Sable Agent to prepare the action again.'
      : plan.requiresTransaction
      ? 'Review the proposal, then click Approve & Sign to open your wallet.'
      : 'Review the read-only response.',
    simulation: {
      available: false,
      summary: plan.requiresTransaction
        ? 'Simulation unavailable for this action in the chat proposal. Wallet and RPC preflight still run during signing.'
        : 'No transaction simulation required for read-only actions.',
    },
  };
}

function requiresTreasury(plan: AgentActionPlan) {
  return !['CREATE_TREASURY', 'COMPLETE_SETUP', 'SHOW_SETTINGS', 'UNKNOWN'].includes(plan.actionType);
}

function collectAccounts(plan: AgentActionPlan, context: AgentToolContext) {
  const accounts = new Set<string>();
  if (context.walletPubkey) accounts.add(`Wallet: ${context.walletPubkey}`);
  if (plan.mint) accounts.add(`Mint: ${plan.mint}`);
  if (plan.recipient) accounts.add(`Recipient: ${plan.recipient}`);
  for (const recipient of plan.recipients || []) accounts.add(`Recipient: ${recipient.address}`);
  if (plan.destinationAta) accounts.add(`Destination ATA: ${plan.destinationAta}`);
  return Array.from(accounts);
}

function riskForPlan(plan: AgentActionPlan, blocked: boolean): AgentRiskLevel {
  if (blocked) return 'BLOCKED';
  if (['WITHDRAW', 'EXTERNAL_SEND', 'DELEGATE', 'COMMIT_UNDELEGATE'].includes(plan.actionType)) return 'HIGH';
  if (['DEPOSIT', 'INTERNAL_TRANSFER', 'BATCH_TRANSFER'].includes(plan.actionType)) return 'MEDIUM';
  return 'LOW';
}

export function isValidPublicKey(value: string) {
  try {
    new PublicKey(value);
    return true;
  } catch {
    return false;
  }
}

function isPositiveAmount(value: string) {
  return /^\d+(\.\d+)?$/.test(value) && Number(value) > 0;
}
