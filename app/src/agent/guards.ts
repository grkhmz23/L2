import { PublicKey } from '@solana/web3.js';
import type { AgentActionPlan, AgentProposal, AgentRiskLevel, AgentToolContext } from './types';

export function buildAgentProposal(plan: AgentActionPlan, context: AgentToolContext): AgentProposal {
  const prerequisites: string[] = [];
  const warnings = [...plan.warnings];
  const accountsTouched = collectAccounts(plan, context);

  if (plan.domain !== 'sable_protocol') {
    prerequisites.push('This request is outside Sable protocol action scope.');
  }
  if (plan.requiresTransaction && !context.walletConnected) {
    prerequisites.push('Please connect your wallet first. I can prepare the next step after that.');
  }
  if (requiresTreasury(plan) && !context.userStateExists) {
    prerequisites.push('You need a Sable treasury before using assets. I can prepare treasury setup for you.');
  }
  if (plan.missingFields.length > 0) {
    prerequisites.push(`Missing required field(s): ${plan.missingFields.join(', ')}.`);
  }
  if (plan.amount && !isPositiveAmount(plan.amount)) {
    prerequisites.push('Please enter a positive amount.');
  }
  for (const recipient of plan.recipients || []) {
    if (!isValidPublicKey(recipient.address)) {
      prerequisites.push(`This recipient address doesn't look right: ${recipient.address}. Please check and try again.`);
    }
  }
  if (plan.recipient && !isValidPublicKey(plan.recipient)) {
    prerequisites.push(`This recipient address doesn't look right. Please check and try again.`);
  }
  if (plan.mint && !isValidPublicKey(plan.mint)) {
    prerequisites.push(`This asset address doesn't look right. Please check and try again.`);
  }
  if (plan.destinationAta && !isValidPublicKey(plan.destinationAta)) {
    prerequisites.push('This destination address doesn\'t look right. Please check and try again.');
  }
  if ((plan.actionType === 'DELEGATE' || plan.route === 'MagicBlock Router' || plan.route === 'ER') && !context.magicBlockAvailable) {
    prerequisites.push('Fast MagicBlock mode is not configured in this environment. You can still use direct Sable vault actions.');
  }
  if (plan.actionType === 'WITHDRAW') {
    const mint = plan.mint;
    const delegated = context.knownMints.some((m) => (!mint || m.mint === mint) && m.isDelegated);
    if (delegated) {
      prerequisites.push('Your treasury is still in fast MagicBlock mode. I\'ll prepare Commit / Undelegate first, then you can withdraw.');
    }
  }

  if (plan.actionType === 'EXTERNAL_SEND') {
    warnings.push('External sends move tokens from the Sable vault to the recipient\'s wallet on Solana. This uses your L1 balance and may create a new token account for the recipient.');
  }
  if (plan.actionType === 'BATCH_TRANSFER') {
    warnings.push('Batch sends may require multiple wallet approvals when chunked into several transactions.');
  }
  if (plan.requiresTransaction) {
    warnings.push('Sable Agent only prepares this action. Your wallet must approve and sign. The agent cannot sign for you.');
  }

  const blocked =
    prerequisites.length > 0 ||
    ['UNKNOWN', 'OUT_OF_SCOPE', 'CLARIFY_SABLE_ACTION'].includes(plan.actionType);
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
      ? 'Resolve the items above, then ask me to prepare the action again.'
      : plan.requiresTransaction
      ? 'Review the proposal, then click Approve & open wallet to sign.'
      : 'Review the read-only response.',
    simulation: {
      available: false,
      summary: plan.requiresTransaction
        ? 'Transaction simulation runs inside your wallet before you sign. I cannot simulate on your behalf.'
        : 'No transaction simulation required for read-only actions.',
    },
  };
}

function requiresTreasury(plan: AgentActionPlan) {
  return !['CREATE_TREASURY', 'COMPLETE_SETUP', 'SHOW_SETTINGS', 'OUT_OF_SCOPE', 'CLARIFY_SABLE_ACTION', 'UNKNOWN'].includes(plan.actionType);
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
