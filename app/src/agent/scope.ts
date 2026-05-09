import type { AgentScopeResult, AgentToolContext } from './types';

export const SABLE_SCOPE_REFUSAL =
  'I can only help with Sable treasury actions inside this app: setup, assets, deposits, transfers, delegation, commit/undelegate, withdrawals, and settings.';

export const SABLE_SCOPE_CLARIFICATION =
  'Which Sable action do you want to perform: setup, add asset, deposit, send, delegate, commit, withdraw, or settings?';

export const SABLE_SUGGESTED_COMMANDS = [
  'Create my treasury',
  'Add USDC',
  'Deposit 1 USDC',
  'Withdraw to my wallet',
];

const SABLE_ACTION_RE =
  /\b(sable|treasury|setup|create\s+(my\s+)?treasury|complete\s+setup|wsol|usdc|mint|asset|balance|balances|deposit|vault|send|transfer|batch|recipient|external\s+send|delegate|magicblock|er\b|commit|undelegate|withdraw|wallet|settings|config|rpc|program|router|pda|ledger)\b/i;

const BLOCKED_RE =
  /\b(bitcoin|btc|price|market|markets|investment|invest|financial advice|legal advice|medical advice|politics|joke|story|article|summari[sz]e|search|web|code|coding|programming|trading bot|bot|best token|token should i buy|what should i buy|chat with me|general|weather|news|sports)\b/i;

const AMBIGUOUS_RE = /^(help|help me|hi|hello|hey|what can you do|start|assist|agent)$/i;

export function classifySableScope(
  message: string,
  _context?: Partial<AgentToolContext>
): AgentScopeResult {
  const text = message.trim();
  if (!text) return { domain: 'ambiguous', reason: 'Empty request' };

  if (AMBIGUOUS_RE.test(text)) {
    return { domain: 'ambiguous', reason: 'Ambiguous helper request' };
  }

  const hasSableAction = SABLE_ACTION_RE.test(text);
  const hasBlockedTopic = BLOCKED_RE.test(text);

  if (hasBlockedTopic && !hasSableAction) {
    return { domain: 'out_of_scope', reason: 'Request is outside Sable protocol actions' };
  }

  if (hasSableAction) {
    return { domain: 'sable_protocol', reason: 'Request matches Sable protocol action scope' };
  }

  return { domain: 'out_of_scope', reason: 'No supported Sable protocol action detected' };
}

export function isSableScopedRequest(message: string, context?: Partial<AgentToolContext>) {
  return classifySableScope(message, context).domain === 'sable_protocol';
}

export function buildOutOfScopePlan(message: string) {
  return {
    actionType: 'OUT_OF_SCOPE' as const,
    domain: 'out_of_scope' as const,
    intent: {
      actionType: 'OUT_OF_SCOPE' as const,
      confidence: 1,
      reason: 'Rejected by local Sable scope classifier',
    },
    summary: SABLE_SCOPE_REFUSAL,
    route: 'Read only' as const,
    requiresTransaction: false,
    rawText: message,
    missingFields: [],
    warnings: [],
  };
}

export function buildClarificationPlan(message: string) {
  return {
    actionType: 'CLARIFY_SABLE_ACTION' as const,
    domain: 'ambiguous' as const,
    intent: {
      actionType: 'CLARIFY_SABLE_ACTION' as const,
      confidence: 1,
      reason: 'Ambiguous request needs Sable action clarification',
    },
    summary: SABLE_SCOPE_CLARIFICATION,
    route: 'Read only' as const,
    requiresTransaction: false,
    rawText: message,
    missingFields: [],
    warnings: [],
  };
}
