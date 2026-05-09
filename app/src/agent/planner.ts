import type { AgentActionPlan, AgentActionType, AgentToolContext, AgentTransferRecipient } from './types';

const PUBKEY_RE = /[1-9A-HJ-NP-Za-km-z]{32,44}/g;
const AMOUNT_RE = /(?:^|\s)(\d+(?:\.\d+)?)(?:\s+|$)/;

const actionLabels: Record<AgentActionType, string> = {
  CREATE_TREASURY: 'Create treasury',
  COMPLETE_SETUP: 'Complete setup',
  ADD_WS0L_BALANCE: 'Add wSOL balance',
  ADD_MINT: 'Add mint',
  DEPOSIT: 'Deposit to vault',
  INTERNAL_TRANSFER: 'Internal send',
  BATCH_TRANSFER: 'Batch send',
  EXTERNAL_SEND: 'External vault send',
  DELEGATE: 'Delegate to MagicBlock ER',
  COMMIT_UNDELEGATE: 'Commit / undelegate',
  WITHDRAW: 'Withdraw to wallet',
  EXPLAIN_BALANCES: 'Explain balances',
  SHOW_SETTINGS: 'Show settings',
  UNKNOWN: 'Unknown request',
};

export function normalizeAgentPlan(plan: Partial<AgentActionPlan>, rawText: string): AgentActionPlan {
  const actionType = plan.actionType || 'UNKNOWN';
  return {
    actionType,
    intent: plan.intent || {
      actionType,
      confidence: actionType === 'UNKNOWN' ? 0.2 : 0.75,
      reason: 'Parsed by deterministic planner',
    },
    summary: plan.summary || actionLabels[actionType],
    amount: plan.amount,
    mint: plan.mint,
    mintSymbol: plan.mintSymbol,
    recipient: plan.recipient,
    recipients: plan.recipients || [],
    destinationAta: plan.destinationAta,
    route: plan.route || defaultRoute(actionType),
    requiresTransaction: plan.requiresTransaction ?? requiresTransaction(actionType),
    rawText,
    missingFields: plan.missingFields || [],
    warnings: plan.warnings || [],
  };
}

export function deterministicPlan(input: string, context?: Partial<AgentToolContext>): AgentActionPlan {
  const rawText = input.trim();
  const text = rawText.toLowerCase();
  const addresses = rawText.match(PUBKEY_RE) || [];
  const amount = extractAmount(rawText);
  const mintInfo = extractMint(rawText, context);

  if (!rawText) return normalizeAgentPlan({ actionType: 'UNKNOWN', summary: 'Ask Sable Agent for a treasury action' }, rawText);

  if (/(settings|config|rpc|program|router)/i.test(rawText)) {
    return normalizeAgentPlan({ actionType: 'SHOW_SETTINGS', summary: 'Show Settings, RPC, program, and router configuration' }, rawText);
  }

  if (/(explain|show|what).*(balance|balances)|balances?/i.test(rawText) && !/(add|deposit|send|withdraw)/i.test(rawText)) {
    return normalizeAgentPlan({ actionType: 'EXPLAIN_BALANCES', summary: 'Explain current treasury balances' }, rawText);
  }

  if (/(create|join).*(treasury|account|sable)|\bjoin\b/i.test(rawText)) {
    return normalizeAgentPlan({ actionType: 'CREATE_TREASURY', summary: 'Create your Sable treasury UserState' }, rawText);
  }

  if (/(complete|finish).*(setup)|setup/i.test(rawText)) {
    return normalizeAgentPlan({ actionType: 'COMPLETE_SETUP', summary: 'Complete setup with the default wSOL balance' }, rawText);
  }

  if (/(add|create).*(wsol|wrapped sol)/i.test(rawText)) {
    return normalizeAgentPlan({
      actionType: 'ADD_WS0L_BALANCE',
      mint: context?.wsolMint,
      mintSymbol: 'wSOL',
      summary: 'Add the default wSOL balance PDA',
    }, rawText);
  }

  if (/(add|track).*(mint|asset|usdc|wsol)|^add\s+[a-z0-9]+/i.test(rawText)) {
    return normalizeAgentPlan({
      actionType: 'ADD_MINT',
      mint: mintInfo.mint,
      mintSymbol: mintInfo.symbol,
      summary: `Add ${mintInfo.symbol || 'asset'} to your Sable treasury`,
      missingFields: mintInfo.mint ? [] : ['mint'],
    }, rawText);
  }

  if (/deposit|fund|top up|top-up/i.test(rawText)) {
    return normalizeAgentPlan({
      actionType: 'DEPOSIT',
      amount,
      mint: mintInfo.mint,
      mintSymbol: mintInfo.symbol,
      summary: `Deposit ${amount || ''} ${mintInfo.symbol || 'tokens'} to the vault`.trim(),
      missingFields: missing(['amount', 'mint'], { amount, mint: mintInfo.mint }),
    }, rawText);
  }

  if (/batch|these addresses|recipients|addresses:/i.test(rawText) && /(send|transfer)/i.test(rawText)) {
    const recipients = extractRecipients(rawText, amount);
    return normalizeAgentPlan({
      actionType: 'BATCH_TRANSFER',
      amount,
      mint: mintInfo.mint,
      mintSymbol: mintInfo.symbol,
      recipients,
      summary: `Prepare batch send to ${recipients.length} recipient(s)`,
      missingFields: missing(['amount', 'mint', 'recipients'], {
        amount: recipients.some((r) => r.amount) ? 'per-row' : amount,
        mint: mintInfo.mint,
        recipients: recipients.length ? 'yes' : '',
      }),
    }, rawText);
  }

  if (/(external|vault send|send.*external)/i.test(rawText)) {
    return normalizeAgentPlan({
      actionType: 'EXTERNAL_SEND',
      amount,
      mint: mintInfo.mint,
      mintSymbol: mintInfo.symbol,
      recipient: addresses[0],
      recipients: addresses[0] ? [{ address: addresses[0], amount }] : [],
      summary: `Prepare external vault send${addresses[0] ? ` to ${addresses[0]}` : ''}`,
      missingFields: missing(['amount', 'mint', 'recipient'], { amount, mint: mintInfo.mint, recipient: addresses[0] }),
    }, rawText);
  }

  if (/(send|transfer|pay)\b/i.test(rawText)) {
    return normalizeAgentPlan({
      actionType: 'INTERNAL_TRANSFER',
      amount,
      mint: mintInfo.mint,
      mintSymbol: mintInfo.symbol,
      recipient: addresses[0],
      recipients: addresses[0] ? [{ address: addresses[0], amount }] : [],
      summary: `Prepare internal send${addresses[0] ? ` to ${addresses[0]}` : ''}`,
      missingFields: missing(['amount', 'mint', 'recipient'], { amount, mint: mintInfo.mint, recipient: addresses[0] }),
    }, rawText);
  }

  if (/commit|undelegate|finali[sz]e/i.test(rawText)) {
    return normalizeAgentPlan({
      actionType: 'COMMIT_UNDELEGATE',
      mint: mintInfo.mint,
      mintSymbol: mintInfo.symbol,
      summary: `Commit and undelegate ${mintInfo.symbol || 'tracked balances'} back to L1`,
    }, rawText);
  }

  if (/delegate|magicblock|er\b/i.test(rawText)) {
    return normalizeAgentPlan({
      actionType: 'DELEGATE',
      mint: mintInfo.mint,
      mintSymbol: mintInfo.symbol,
      summary: `Delegate ${mintInfo.symbol || 'tracked balances'} to MagicBlock ER`,
      warnings: ['MagicBlock delegation only works when router and delegation services are configured.'],
    }, rawText);
  }

  if (/withdraw|cash out|settle/i.test(rawText)) {
    return normalizeAgentPlan({
      actionType: 'WITHDRAW',
      amount,
      mint: mintInfo.mint,
      mintSymbol: mintInfo.symbol,
      destinationAta: addresses[0],
      summary: `Withdraw ${amount || ''} ${mintInfo.symbol || 'tokens'} to wallet`.trim(),
      missingFields: missing(['amount', 'mint'], { amount, mint: mintInfo.mint }),
    }, rawText);
  }

  return normalizeAgentPlan({
    actionType: 'UNKNOWN',
    summary: 'I can prepare treasury setup, mint, deposit, send, delegate, commit, withdraw, balance, and settings actions.',
    requiresTransaction: false,
  }, rawText);
}

export function requiresTransaction(actionType: AgentActionType): boolean {
  return !['EXPLAIN_BALANCES', 'SHOW_SETTINGS', 'UNKNOWN'].includes(actionType);
}

function defaultRoute(actionType: AgentActionType): AgentActionPlan['route'] {
  if (actionType === 'DELEGATE') return 'ER';
  if (actionType === 'EXPLAIN_BALANCES' || actionType === 'SHOW_SETTINGS' || actionType === 'UNKNOWN') return 'Read only';
  return 'Direct Anchor';
}

function extractAmount(input: string): string | undefined {
  return input.match(AMOUNT_RE)?.[1];
}

function extractMint(input: string, context?: Partial<AgentToolContext>): { mint?: string; symbol?: string } {
  const lower = input.toLowerCase();
  if (/\busdc\b/.test(lower)) return { mint: context?.usdcMint, symbol: 'USDC' };
  if (/\bwsol\b|wrapped sol|\bsol\b/.test(lower)) return { mint: context?.wsolMint, symbol: 'wSOL' };

  const address = (input.match(PUBKEY_RE) || []).find((candidate) => candidate.length >= 32);
  const known = context?.knownMints?.find(
    (m) => lower.includes(m.symbol.toLowerCase()) || m.mint === address
  );
  if (known) return { mint: known.mint, symbol: known.symbol };
  if (context?.selectedMint) return { mint: context.selectedMint, symbol: 'selected mint' };
  return { mint: address, symbol: address ? 'mint' : undefined };
}

function extractRecipients(input: string, defaultAmount?: string): AgentTransferRecipient[] {
  const lines = input.split(/\n|;/).map((line) => line.trim()).filter(Boolean);
  const recipients: AgentTransferRecipient[] = [];
  for (const line of lines) {
    const addresses = line.match(PUBKEY_RE) || [];
    for (const address of addresses) {
      const beforeAddress = line.slice(0, line.indexOf(address));
      const lineAmount = beforeAddress.match(/(\d+(?:\.\d+)?)/)?.[1] || defaultAmount;
      recipients.push({ address, amount: lineAmount });
    }
  }
  return uniqueRecipients(recipients);
}

function uniqueRecipients(recipients: AgentTransferRecipient[]) {
  const seen = new Set<string>();
  return recipients.filter((recipient) => {
    if (seen.has(recipient.address)) return false;
    seen.add(recipient.address);
    return true;
  });
}

function missing(names: string[], values: Record<string, string | undefined>) {
  return names.filter((name) => !values[name]);
}
