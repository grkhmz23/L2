'use client';

import { useCallback, useMemo, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useWalletContext } from '@/contexts/WalletContext';
import { buildAgentToolContext } from '@/agent/context';
import { deterministicPlan } from '@/agent/planner';
import { buildAgentProposal } from '@/agent/guards';
import {
  SABLE_GREETING,
  SABLE_SCOPE_CLARIFICATION,
  SABLE_SCOPE_REFUSAL,
  SABLE_SUGGESTED_COMMANDS,
  classifySableScope,
} from '@/agent/scope';
import { executeAgentPlan, formatAgentError } from '@/agent/tools';
import type { AgentMessage, AgentProposal, AgentProviderResponse, AgentToolContext, AgentExecutionStep } from '@/agent/types';
import {
  CopyButton,
  GlassPanel,
  LuxuryButton,
  LuxuryTextarea,
  Pill,
  SectionHeader,
  TimelineItem,
  cn,
  truncateAddress,
} from '@/components/ui/luxury';
import toast from 'react-hot-toast';

const starterPrompts = [
  'Create my treasury',
  'Add USDC',
  'Deposit tokens',
  'Send tokens',
  'Batch send',
  'Withdraw',
  'Commit / Undelegate',
  'Show my settings',
];

export function AgentChatPanel({ compact = false }: { compact?: boolean }) {
  const wallet = useWallet();
  const { sdk, solanaSdk, solanaConnection, routingMode, refreshUserState } = useWalletContext();
  const [messages, setMessages] = useState<AgentMessage[]>([
    {
      id: 'intro',
      role: 'assistant',
      content:
        'Tell me what you want to do with your Sable treasury. I\'ll prepare it, and you approve every transaction.',
      category: 'info',
      createdAt: new Date().toISOString(),
    },
  ]);
  const [input, setInput] = useState('');
  const [proposal, setProposal] = useState<AgentProposal | null>(null);
  const [context, setContext] = useState<AgentToolContext | null>(null);
  const [isPlanning, setIsPlanning] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [lastSignature, setLastSignature] = useState<string | null>(null);
  const [executionSteps, setExecutionSteps] = useState<AgentExecutionStep[]>([]);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [submittedInput, setSubmittedInput] = useState<string | null>(null);

  const addMessage = useCallback((role: AgentMessage['role'], content: string, category?: AgentMessage['category']) => {
    setMessages((current) => [
      ...current,
      { id: `${Date.now()}-${role}-${Math.random().toString(36).slice(2, 6)}`, role, content, category, createdAt: new Date().toISOString() },
    ]);
  }, []);

  const setStep = useCallback((label: string, state: AgentExecutionStep['state']) => {
    setExecutionSteps((prev) => {
      const next = prev.map((s) => ({ ...s, active: false }));
      const existing = next.find((s) => s.label === label);
      if (existing) {
        existing.state = state;
        existing.active = true;
      } else {
        next.push({ label, state, active: true });
      }
      return next;
    });
  }, []);

  const preparePlan = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    if (submittedInput === trimmed && isPlanning) return;
    setSubmittedInput(trimmed);
    setInput('');
    setLastSignature(null);
    setExecutionSteps([]);
    addMessage('user', trimmed);
    setIsPlanning(true);
    try {
      const builtContext = await buildAgentToolContext({
        sdk,
        solanaSdk,
        walletPubkey: wallet.publicKey,
        walletConnected: wallet.connected,
        routingMode,
      });
      setContext(builtContext);

      const scope = classifySableScope(trimmed, builtContext);
      if (scope.domain === 'out_of_scope') {
        setProposal(null);
        addMessage('assistant', `${SABLE_SCOPE_REFUSAL}\n\nTry: ${SABLE_SUGGESTED_COMMANDS.join(', ')}`, 'warning');
        return;
      }
      if (scope.domain === 'ambiguous') {
        setProposal(null);
        addMessage(
          'assistant',
          scope.reason === 'Greeting'
            ? `${SABLE_GREETING}\n\nTry: ${SABLE_SUGGESTED_COMMANDS.join(', ')}`
            : SABLE_SCOPE_CLARIFICATION,
          'info'
        );
        return;
      }

      let response: AgentProviderResponse;
      try {
        const apiResponse = await fetch('/api/agent', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ message: trimmed, context: builtContext }),
        });
        if (!apiResponse.ok) throw new Error('Planner route failed');
        response = await apiResponse.json();
      } catch {
        response = {
          provider: 'deterministic',
          model: 'rule-based',
          plan: deterministicPlan(trimmed, builtContext),
          usedFallback: true,
        };
      }

      if (response.plan.domain !== 'sable_protocol') {
        setProposal(null);
        addMessage(
          'assistant',
          response.plan.actionType === 'CLARIFY_SABLE_ACTION'
            ? response.plan.summary
            : `${SABLE_SCOPE_REFUSAL}\n\nTry: ${SABLE_SUGGESTED_COMMANDS.join(', ')}`,
          response.plan.actionType === 'CLARIFY_SABLE_ACTION' ? 'info' : 'warning'
        );
        return;
      }

      const nextProposal = buildAgentProposal(response.plan, builtContext);
      setProposal(nextProposal);

      if (nextProposal.blocked) {
        addMessage(
          'assistant',
          `I can't prepare this action yet.\n\n${nextProposal.prerequisites.join('\n')}`,
          'prerequisite'
        );
        return;
      }

      if (!nextProposal.plan.requiresTransaction) {
        addMessage('assistant', nextProposal.summary, 'info');
        setProposal(null);
        return;
      }

      addMessage(
        'assistant',
        `I prepared: ${nextProposal.summary}\n\n${nextProposal.estimatedNextStep}`,
        'proposal'
      );
    } catch (error: any) {
      const formatted = formatAgentError(error);
      addMessage('assistant', formatted.friendly, 'error');
    } finally {
      setIsPlanning(false);
      setSubmittedInput(null);
    }
  }, [addMessage, routingMode, sdk, solanaSdk, wallet.connected, wallet.publicKey, submittedInput, isPlanning]);

  const approve = useCallback(async () => {
    if (!proposal || !context) return;
    setIsExecuting(true);
    setExecutionSteps([
      { label: 'Preparing request', state: 'done', active: false },
      { label: 'Checking treasury', state: 'done', active: false },
      { label: 'Building transaction', state: 'done', active: false },
      { label: 'Waiting for your wallet signature', state: 'active', active: true },
      { label: 'Sending transaction', state: 'pending', active: false },
      { label: 'Confirming', state: 'pending', active: false },
    ]);
    try {
      const result = await executeAgentPlan({
        proposal,
        context,
        sdk,
        solanaSdk,
        solanaConnection,
        userApproved: true,
      });
      const signature = result.signature || result.signatures?.[0] || null;
      setLastSignature(signature);
      setStep('Waiting for your wallet signature', 'done');
      setStep('Sending transaction', 'done');
      setStep('Confirming', 'done');

      const sigLine = signature ? `Transaction signature:\n${signature}` : '';
      addMessage(
        'assistant',
        `${result.message}${sigLine ? `\n\n${sigLine}` : ''}`,
        'success'
      );
      setProposal(null);
      await refreshUserState();
      toast.success(result.message);
    } catch (error: any) {
      const formatted = formatAgentError(error);
      setStep('Waiting for your wallet signature', 'failed');
      setStep('Sending transaction', 'failed');
      setStep('Confirming', 'failed');
      addMessage('assistant', formatted.friendly, 'error');
      toast.error(formatted.friendly);
    } finally {
      setIsExecuting(false);
    }
  }, [addMessage, context, proposal, refreshUserState, sdk, solanaConnection, solanaSdk, setStep]);

  const reject = useCallback(() => {
    setProposal(null);
    setExecutionSteps([]);
    addMessage('assistant', 'Rejected by user. No transaction was sent.', 'rejected');
  }, [addMessage]);

  const stateLines = useMemo(() => {
    if (!context) return ['Context loads after your first request.'];
    return [
      `Wallet: ${context.walletPubkey ? truncateAddress(context.walletPubkey, 6, 6) : 'not connected'}`,
      `Treasury: ${context.userStateExists ? 'found' : 'missing'}`,
      `Mode: ${context.routingMode === 'er' ? 'MagicBlock ER' : 'Solana L1'}`,
      `Assets: ${context.knownMints.length}`,
    ];
  }, [context]);

  return (
    <GlassPanel className={cn('p-5 md:p-6', compact ? 'space-y-4' : 'space-y-6')}>
      <SectionHeader
        eyebrow="Sable Agent Chat"
        title="Treasury Actions By Proposal"
        subtitle="Tell me what you want to do with your Sable treasury. I’ll prepare it, and you approve every transaction."
      />

      <div className={cn('grid gap-5', compact ? '' : 'xl:grid-cols-[minmax(0,1fr)_380px]')}>
        <div className="space-y-4">
          <AgentMessageList messages={messages} />
          <AgentInputBox
            value={input}
            onChange={setInput}
            onSubmit={() => preparePlan(input)}
            isLoading={isPlanning || isExecuting}
          />
          <div className="flex flex-wrap gap-2">
            {starterPrompts.map((prompt) => (
              <button
                key={prompt}
                type="button"
                onClick={() => preparePlan(prompt)}
                disabled={isPlanning || isExecuting}
                className="rounded-md border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-zinc-300 transition hover:border-amber-200/25 hover:text-amber-100 disabled:opacity-45"
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          {proposal ? (
            <AgentProposalCard
              proposal={proposal}
              onApprove={approve}
              onReject={reject}
              isExecuting={isExecuting}
            />
          ) : (
            <AgentExecutionTimeline steps={executionSteps} lastSignature={lastSignature} />
          )}
          <AgentStateInspector
            lines={stateLines}
            context={context}
            open={advancedOpen}
            onToggle={() => setAdvancedOpen((v) => !v)}
          />
        </div>
      </div>
    </GlassPanel>
  );
}

function AgentMessageList({ messages }: { messages: AgentMessage[] }) {
  return (
    <div className="h-[380px] overflow-y-auto rounded-lg border border-white/8 bg-black/30 p-4 sable-subtle-scrollbar">
      <div className="space-y-3">
        {messages.map((message) => {
          const isUser = message.role === 'user';
          const category = message.category || 'info';
          const styles = messageStyles[category];
          return (
            <div
              key={message.id}
              className={cn(
                'max-w-[92%] rounded-lg border px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap',
                isUser
                  ? 'ml-auto border-amber-200/18 bg-amber-200/8 text-amber-50'
                  : styles.container
              )}
            >
              {message.content}
            </div>
          );
        })}
      </div>
    </div>
  );
}

const messageStyles: Record<NonNullable<AgentMessage['category']>, { container: string }> = {
  info: { container: 'border-white/8 bg-white/[0.03] text-zinc-300' },
  prerequisite: { container: 'border-amber-300/20 bg-amber-300/8 text-amber-100' },
  proposal: { container: 'border-emerald-300/20 bg-emerald-300/8 text-emerald-100' },
  warning: { container: 'border-rose-300/20 bg-rose-300/8 text-rose-100' },
  success: { container: 'border-emerald-300/20 bg-emerald-300/8 text-emerald-100' },
  rejected: { container: 'border-zinc-500/20 bg-zinc-500/8 text-zinc-400' },
  error: { container: 'border-rose-300/20 bg-rose-300/8 text-rose-100' },
};

function AgentInputBox({
  value,
  onChange,
  onSubmit,
  isLoading,
}: {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  isLoading: boolean;
}) {
  return (
    <div className="space-y-3">
      <LuxuryTextarea
        label="Ask Sable Agent"
        rows={3}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            if (value.trim() && !isLoading) onSubmit();
          }
        }}
        placeholder="Try: Deposit 1 USDC&#10;Try: Send 0.5 USDC to <address>"
        className="font-sans"
      />
      <LuxuryButton fullWidth onClick={onSubmit} isLoading={isLoading} disabled={!value.trim() || isLoading}>
        Prepare Proposal
      </LuxuryButton>
    </div>
  );
}

export function AgentProposalCard({
  proposal,
  onApprove,
  onReject,
  isExecuting,
}: {
  proposal: AgentProposal;
  onApprove: () => void;
  onReject: () => void;
  isExecuting: boolean;
}) {
  const tone = proposal.riskLevel === 'BLOCKED' || proposal.riskLevel === 'HIGH' ? 'red' : proposal.riskLevel === 'MEDIUM' ? 'amber' : 'green';
  const plainTitle = plainEnglishTitle(proposal);
  const plainDescription = plainEnglishDescription(proposal);
  const routeLabel = routePlainLabel(proposal.route);

  return (
    <div className="rounded-xl border border-amber-200/16 bg-black/35 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.24em] text-zinc-500">Proposal</p>
          <h3 className="mt-1 text-lg text-white">{plainTitle}</h3>
        </div>
        <Pill tone={tone}>{proposal.riskLevel}</Pill>
      </div>

      <div className="mt-4 space-y-3 text-sm text-zinc-300">
        <p className="leading-relaxed">{plainDescription}</p>

        {proposal.plan.amount || proposal.plan.mintSymbol ? (
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase tracking-[0.16em] text-zinc-600">Amount</span>
            <span className="rounded-md border border-white/10 bg-white/[0.03] px-2.5 py-1 text-xs text-zinc-200">
              {proposal.plan.amount || '-'} {proposal.plan.mintSymbol || 'tokens'}
            </span>
          </div>
        ) : null}

        {proposal.plan.recipient ? (
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase tracking-[0.16em] text-zinc-600">Recipient</span>
            <span className="inline-flex max-w-full min-w-0 items-center gap-2 rounded-md border border-white/10 bg-white/[0.03] px-2.5 py-1">
              <span className="min-w-0 truncate font-mono text-xs text-zinc-300">{truncateAddress(proposal.plan.recipient, 10, 8)}</span>
              <CopyButton value={proposal.plan.recipient} label="Copy recipient" />
            </span>
          </div>
        ) : null}

        {proposal.plan.recipients && proposal.plan.recipients.length > 0 ? (
          <div className="space-y-2">
            <span className="text-xs uppercase tracking-[0.16em] text-zinc-600">Recipients ({proposal.plan.recipients.length})</span>
            <div className="flex flex-wrap gap-2">
              {proposal.plan.recipients.map((r) => (
                <span key={r.address} className="inline-flex max-w-full min-w-0 items-center gap-2 rounded-md border border-white/10 bg-white/[0.03] px-2.5 py-1">
                  <span className="min-w-0 truncate font-mono text-xs text-zinc-300">{truncateAddress(r.address, 8, 4)}</span>
                  {r.amount ? <span className="text-xs text-zinc-500">{r.amount}</span> : null}
                  <CopyButton value={r.address} label="Copy address" />
                </span>
              ))}
            </div>
          </div>
        ) : null}

        <div className="flex items-center gap-2">
          <span className="text-xs uppercase tracking-[0.16em] text-zinc-600">Route</span>
          <span className="rounded-md border border-white/10 bg-white/[0.03] px-2.5 py-1 text-xs text-zinc-200">
            {routeLabel}
          </span>
        </div>
      </div>

      {proposal.prerequisites.length > 0 ? (
        <div className="mt-4 rounded-lg border border-amber-300/15 bg-amber-300/8 p-3">
          <p className="text-[10px] uppercase tracking-[0.2em] text-amber-200/80">Required before signing</p>
          <div className="mt-2 space-y-2">
            {proposal.prerequisites.map((item) => (
              <p key={item} className="text-xs text-amber-100">{item}</p>
            ))}
          </div>
        </div>
      ) : null}

      {proposal.warnings.length > 0 ? (
        <div className="mt-4 rounded-lg border border-rose-300/15 bg-rose-300/8 p-3">
          <p className="text-[10px] uppercase tracking-[0.2em] text-rose-200/80">Warnings</p>
          <div className="mt-2 space-y-2">
            {proposal.warnings.map((item) => (
              <p key={item} className="text-xs text-rose-100">{item}</p>
            ))}
          </div>
        </div>
      ) : null}

      <div className="mt-4 rounded-lg border border-white/8 bg-white/[0.03] p-3 text-xs text-zinc-400">
        {proposal.simulation.summary}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <LuxuryButton variant="secondary" onClick={onReject} disabled={isExecuting}>
          Reject
        </LuxuryButton>
        <LuxuryButton onClick={onApprove} isLoading={isExecuting} disabled={proposal.blocked}>
          {isExecuting ? 'Open your wallet…' : 'Approve & open wallet'}
        </LuxuryButton>
      </div>
    </div>
  );
}

function plainEnglishTitle(proposal: AgentProposal): string {
  const plan = proposal.plan;
  switch (plan.actionType) {
    case 'CREATE_TREASURY': return 'Create your Sable treasury';
    case 'COMPLETE_SETUP': return 'Complete your treasury setup';
    case 'ADD_WS0L_BALANCE': return 'Add wSOL to your treasury';
    case 'ADD_MINT': return `Add ${plan.mintSymbol || 'asset'} to your treasury`;
    case 'DEPOSIT': return `Deposit ${plan.amount || ''} ${plan.mintSymbol || 'tokens'} into your Sable vault`.trim();
    case 'INTERNAL_TRANSFER': return `Send ${plan.amount || ''} ${plan.mintSymbol || 'tokens'} to ${plan.recipient ? truncateAddress(plan.recipient, 6, 4) : 'a recipient'}`.trim();
    case 'BATCH_TRANSFER': return `Batch send ${plan.mintSymbol || 'tokens'} to ${plan.recipients?.length || 0} recipient(s)`;
    case 'EXTERNAL_SEND': return `External send ${plan.amount || ''} ${plan.mintSymbol || 'tokens'}`.trim();
    case 'DELEGATE': return `Enter fast MagicBlock mode${plan.mintSymbol ? ` for ${plan.mintSymbol}` : ''}`;
    case 'COMMIT_UNDELEGATE': return `Save fast-mode changes back to Solana${plan.mintSymbol ? ` for ${plan.mintSymbol}` : ''}`;
    case 'WITHDRAW': return `Withdraw ${plan.amount || ''} ${plan.mintSymbol || 'tokens'} to your wallet`.trim();
    case 'EXPLAIN_BALANCES': return 'Explain balances';
    case 'SHOW_SETTINGS': return 'Show settings';
    default: return proposal.summary;
  }
}

function plainEnglishDescription(proposal: AgentProposal): string {
  const plan = proposal.plan;
  switch (plan.actionType) {
    case 'DEPOSIT':
      return `I prepared a deposit. If you approve, your wallet will ask you to sign a transaction. This moves ${plan.amount || 'tokens'} ${plan.mintSymbol || ''} from your wallet into your Sable vault. The agent cannot sign this for you.`;
    case 'INTERNAL_TRANSFER':
      return `I prepared an internal send. If you approve, your wallet will ask you to sign a transaction. This updates balances inside Sable. The agent cannot sign this for you.`;
    case 'BATCH_TRANSFER':
      return `I prepared a batch send. If you approve, your wallet will ask you to sign one or more transactions. This updates balances inside Sable for all recipients. The agent cannot sign this for you.`;
    case 'EXTERNAL_SEND':
      return `I prepared an external send. If you approve, your wallet will ask you to sign a transaction. This moves tokens from the Sable vault to the recipient's wallet on Solana. The agent cannot sign this for you.`;
    case 'DELEGATE':
      return `I prepared delegation to MagicBlock. If you approve, your wallet will ask you to sign a transaction. This enters fast mode for low-cost execution. The agent cannot sign this for you.`;
    case 'COMMIT_UNDELEGATE':
      return `I prepared commit and undelegate. If you approve, your wallet will ask you to sign a transaction. This saves fast-mode changes back to Solana so you can withdraw. The agent cannot sign this for you.`;
    case 'WITHDRAW':
      return `I prepared a withdrawal. If you approve, your wallet will ask you to sign a transaction. This moves tokens from your Sable vault back to your wallet. The agent cannot sign this for you.`;
    case 'CREATE_TREASURY':
      return `I prepared treasury creation. If you approve, your wallet will ask you to sign a transaction. This creates your Sable treasury on-chain. The agent cannot sign this for you.`;
    case 'COMPLETE_SETUP':
      return `I prepared setup completion. If you approve, your wallet will ask you to sign a transaction. This adds the default wSOL balance to your treasury. The agent cannot sign this for you.`;
    case 'ADD_MINT':
    case 'ADD_WS0L_BALANCE':
      return `I prepared adding an asset. If you approve, your wallet will ask you to sign a transaction. This creates a balance tracking account for the asset in your treasury. The agent cannot sign this for you.`;
    default:
      return `I prepared this action. If you approve, your wallet will ask you to sign. The agent cannot sign for you.`;
  }
}

function routePlainLabel(route: string): string {
  switch (route) {
    case 'Direct Anchor': return 'Direct Sable vault';
    case 'MagicBlock Router': return 'MagicBlock ER';
    case 'ER': return 'MagicBlock ER';
    case 'Read only': return 'Read only';
    default: return route;
  }
}

function AgentExecutionTimeline({
  steps,
  lastSignature,
}: {
  steps: AgentExecutionStep[];
  lastSignature: string | null;
}) {
  const defaultSteps: AgentExecutionStep[] = [
    { label: 'Preparing request', state: 'pending', active: false },
    { label: 'Checking treasury', state: 'pending', active: false },
    { label: 'Building transaction', state: 'pending', active: false },
    { label: 'Waiting for your wallet signature', state: 'pending', active: false },
    { label: 'Sending transaction', state: 'pending', active: false },
    { label: 'Confirming', state: 'pending', active: false },
  ];

  const display = steps.length > 0 ? steps : defaultSteps;

  return (
    <div className="rounded-xl border border-white/8 bg-black/30 p-4">
      <p className="text-[10px] uppercase tracking-[0.24em] text-zinc-500">Execution</p>
      {steps.length === 0 ? (
        <p className="mt-2 text-sm text-zinc-300">
          No active proposal. Prepared actions wait here until you approve or reject them.
        </p>
      ) : (
        <div className="mt-3 space-y-1">
          {display.map((step, index) => (
            <TimelineItem
              key={step.label}
              label={step.label}
              active={step.active}
              done={step.state === 'done'}
              warning={step.state === 'failed'}
              last={index === display.length - 1}
            />
          ))}
        </div>
      )}
      {lastSignature ? (
        <div className="mt-3 flex min-w-0 items-center gap-2 rounded-md border border-emerald-300/15 bg-emerald-300/8 p-2">
          <span className="min-w-0 truncate font-mono text-xs text-emerald-100">{lastSignature}</span>
          <CopyButton value={lastSignature} label="Copy signature" />
        </div>
      ) : null}
    </div>
  );
}

function AgentStateInspector({
  lines,
  context,
  open,
  onToggle,
}: {
  lines: string[];
  context: AgentToolContext | null;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="rounded-xl border border-white/8 bg-black/30 p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <p className="text-[10px] uppercase tracking-[0.24em] text-zinc-500">State</p>
          <Pill tone={context?.walletConnected ? 'green' : 'default'}>
            {context?.walletConnected ? 'Wallet connected' : 'Wallet needed'}
          </Pill>
        </div>
        <button
          type="button"
          onClick={onToggle}
          className="text-[10px] uppercase tracking-[0.16em] text-zinc-500 transition hover:text-zinc-300"
        >
          {open ? 'Hide details' : 'Advanced'}
        </button>
      </div>
      <div className="mt-3 space-y-2">
        {lines.map((line) => (
          <p key={line} className="text-xs text-zinc-400">{line}</p>
        ))}
      </div>
      {open && context ? (
        <div className="mt-4 space-y-2 border-t border-white/8 pt-3">
          <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-600">Details for advanced users</p>
          <DetailRow label="Program ID" value={context.settings.programId} />
          <DetailRow label="RPC" value={context.settings.solanaRpcUrl} />
          <DetailRow label="USDC Mint" value={context.usdcMint} />
          <DetailRow label="wSOL Mint" value={context.wsolMint} />
          <DetailRow label="Route" value={context.routingMode === 'er' ? 'MagicBlock ER' : 'Solana L1'} />
          <DetailRow label="MagicBlock available" value={context.magicBlockAvailable ? 'yes' : 'no'} />
        </div>
      ) : null}
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-3">
      <span className="text-[10px] uppercase tracking-[0.14em] text-zinc-600">{label}</span>
      <span className="flex min-w-0 items-center gap-2 text-right font-mono text-[10px] text-zinc-400">
        <span className="truncate">{truncateAddress(value, 16, 8)}</span>
        <CopyButton value={value} label={`Copy ${label}`} />
      </span>
    </div>
  );
}
