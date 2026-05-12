export type AgentActionType =
  | 'CREATE_TREASURY'
  | 'COMPLETE_SETUP'
  | 'ADD_WS0L_BALANCE'
  | 'ADD_MINT'
  | 'DEPOSIT'
  | 'INTERNAL_TRANSFER'
  | 'BATCH_TRANSFER'
  | 'EXTERNAL_SEND'
  | 'DELEGATE'
  | 'COMMIT_UNDELEGATE'
  | 'WITHDRAW'
  | 'EXPLAIN_BALANCES'
  | 'SHOW_SETTINGS'
  | 'OUT_OF_SCOPE'
  | 'CLARIFY_SABLE_ACTION'
  | 'UNKNOWN';

export type AgentRiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'BLOCKED';

export type AgentProvider = 'deepseek' | 'gemini' | 'groq' | 'none' | 'deterministic';

export type AgentDomain = 'sable_protocol' | 'out_of_scope' | 'ambiguous';

export type AgentMessageCategory =
  | 'info'
  | 'prerequisite'
  | 'proposal'
  | 'warning'
  | 'success'
  | 'rejected'
  | 'error';

export interface AgentMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  category?: AgentMessageCategory;
  createdAt: string;
}

export interface AgentIntent {
  actionType: AgentActionType;
  confidence: number;
  reason: string;
}

export interface AgentTransferRecipient {
  address: string;
  amount?: string;
}

export interface AgentActionPlan {
  actionType: AgentActionType;
  domain: AgentDomain;
  intent: AgentIntent;
  summary: string;
  amount?: string;
  mint?: string;
  mintSymbol?: string;
  recipient?: string;
  recipients?: AgentTransferRecipient[];
  destinationAta?: string;
  route?: 'Direct Anchor' | 'MagicBlock Router' | 'ER' | 'Read only' | 'Unknown';
  requiresTransaction: boolean;
  rawText: string;
  missingFields: string[];
  warnings: string[];
}

export interface AgentProposal {
  id: string;
  plan: AgentActionPlan;
  summary: string;
  route: string;
  accountsTouched: string[];
  prerequisites: string[];
  warnings: string[];
  riskLevel: AgentRiskLevel;
  blocked: boolean;
  estimatedNextStep: string;
  simulation: {
    available: boolean;
    summary: string;
  };
}

export interface AgentExecutionResult {
  ok: boolean;
  actionType: AgentActionType;
  signature?: string;
  signatures?: string[];
  message: string;
}

export interface AgentKnownMint {
  symbol: string;
  mint: string;
  balanceRaw?: string;
  isDelegated?: boolean;
}

export interface AgentToolContext {
  walletConnected: boolean;
  walletPubkey?: string;
  userStateExists: boolean;
  knownMints: AgentKnownMint[];
  selectedMint?: string;
  usdcMint: string;
  wsolMint: string;
  routingMode: 'solana' | 'er';
  magicBlockAvailable: boolean;
  settings: {
    solanaRpcUrl: string;
    magicRouterUrl: string;
    programId: string;
    paymentsApiConfigured: boolean;
    perConfigured: boolean;
  };
}

export interface AgentProviderResponse {
  provider: AgentProvider;
  model: string;
  plan: AgentActionPlan;
  usedFallback: boolean;
}

export interface AgentExecutionStep {
  label: string;
  state: 'pending' | 'active' | 'done' | 'failed';
  active: boolean;
}

export interface AgentScopeResult {
  domain: AgentDomain;
  reason: string;
}
