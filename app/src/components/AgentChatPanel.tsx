'use client';

import { useCallback, useMemo, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useWalletContext } from '@/contexts/WalletContext';
import { buildAgentToolContext } from '@/agent/context';
import { deterministicPlan } from '@/agent/planner';
import { buildAgentProposal } from '@/agent/guards';
import { executeAgentPlan } from '@/agent/tools';
import type { AgentMessage, AgentProposal, AgentProviderResponse, AgentToolContext } from '@/agent/types';
import {
  CopyButton,
  GlassPanel,
  LuxuryButton,
  LuxuryTextarea,
  Pill,
  SectionHeader,
  cn,
  truncateAddress,
} from '@/components/ui/luxury';
import toast from 'react-hot-toast';

const starterPrompts = [
  'Create my treasury.',
  'Add USDC.',
  'Deposit 1 USDC.',
  'Explain my balances.',
];

export function AgentChatPanel({ compact = false }: { compact?: boolean }) {
  const wallet = useWallet();
  const { sdk, solanaSdk, solanaConnection, routingMode, refreshUserState } = useWalletContext();
  const [messages, setMessages] = useState<AgentMessage[]>([
    {
      id: 'intro',
      role: 'assistant',
      content: 'Sable Agent prepares treasury actions. You approve every transaction.',
      createdAt: new Date().toISOString(),
    },
  ]);
  const [input, setInput] = useState('');
  const [proposal, setProposal] = useState<AgentProposal | null>(null);
  const [context, setContext] = useState<AgentToolContext | null>(null);
  const [isPlanning, setIsPlanning] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [lastSignature, setLastSignature] = useState<string | null>(null);

  const addMessage = useCallback((role: AgentMessage['role'], content: string) => {
    setMessages((current) => [
      ...current,
      { id: `${Date.now()}-${role}`, role, content, createdAt: new Date().toISOString() },
    ]);
  }, []);

  const preparePlan = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setInput('');
    setLastSignature(null);
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

      const nextProposal = buildAgentProposal(response.plan, builtContext);
      setProposal(nextProposal);
      addMessage(
        'assistant',
        `${nextProposal.summary}\nPlanner: ${response.provider}${response.usedFallback ? ' fallback' : ''}.\n${nextProposal.estimatedNextStep}`
      );
    } catch (error: any) {
      addMessage('assistant', error.message || 'I could not prepare that action.');
    } finally {
      setIsPlanning(false);
    }
  }, [addMessage, routingMode, sdk, solanaSdk, wallet.connected, wallet.publicKey]);

  const approve = useCallback(async () => {
    if (!proposal || !context) return;
    setIsExecuting(true);
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
      addMessage(
        'assistant',
        `${result.message}${result.signatures ? `\nSignatures:\n${result.signatures.join('\n')}` : signature ? `\nSignature: ${signature}` : ''}`
      );
      setProposal(null);
      await refreshUserState();
      toast.success(result.message);
    } catch (error: any) {
      const message = cleanError(error);
      addMessage('assistant', message);
      toast.error(message);
    } finally {
      setIsExecuting(false);
    }
  }, [addMessage, context, proposal, refreshUserState, sdk, solanaConnection, solanaSdk]);

  const reject = useCallback(() => {
    setProposal(null);
    addMessage('assistant', 'Proposal rejected. No transaction was submitted.');
  }, [addMessage]);

  const stateLines = useMemo(() => {
    if (!context) return ['Context loads after your first request.'];
    return [
      `Wallet: ${context.walletPubkey ? truncateAddress(context.walletPubkey, 6, 6) : 'not connected'}`,
      `Treasury: ${context.userStateExists ? 'found' : 'missing'}`,
      `Mode: ${context.routingMode === 'er' ? 'MagicBlock ER' : 'Solana L1'}`,
      `Mints: ${context.knownMints.length}`,
    ];
  }, [context]);

  return (
    <GlassPanel className={cn('p-5 md:p-6', compact ? 'space-y-4' : 'space-y-6')}>
      <SectionHeader
        eyebrow="Sable Agent Chat"
        title="Treasury Actions By Proposal"
        subtitle="Sable Agent prepares treasury actions. You approve every transaction."
      />

      <div className={cn('grid gap-5', compact ? '' : 'xl:grid-cols-[minmax(0,1fr)_360px]')}>
        <div className="space-y-4">
          <AgentMessageList messages={messages} />
          <AgentInputBox
            value={input}
            onChange={setInput}
            onSubmit={() => preparePlan(input)}
            isLoading={isPlanning}
          />
          <div className="flex flex-wrap gap-2">
            {starterPrompts.map((prompt) => (
              <button
                key={prompt}
                type="button"
                onClick={() => preparePlan(prompt)}
                className="rounded-md border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-zinc-300 transition hover:border-amber-200/25 hover:text-amber-100"
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
            <AgentExecutionTimeline lastSignature={lastSignature} />
          )}
          <AgentStateInspector lines={stateLines} context={context} />
        </div>
      </div>
    </GlassPanel>
  );
}

export function AgentMessageList({ messages }: { messages: AgentMessage[] }) {
  return (
    <div className="h-[360px] overflow-y-auto rounded-lg border border-white/8 bg-black/30 p-4 sable-subtle-scrollbar">
      <div className="space-y-3">
        {messages.map((message) => (
          <div
            key={message.id}
            className={cn(
              'max-w-[92%] rounded-lg border px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap',
              message.role === 'user'
                ? 'ml-auto border-amber-200/18 bg-amber-200/8 text-amber-50'
                : 'border-white/8 bg-white/[0.03] text-zinc-300'
            )}
          >
            {message.content}
          </div>
        ))}
      </div>
    </div>
  );
}

export function AgentInputBox({
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
          if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) onSubmit();
        }}
        placeholder="Send 0.1 USDC to 7abc..."
        className="font-sans"
      />
      <LuxuryButton fullWidth onClick={onSubmit} isLoading={isLoading} disabled={!value.trim()}>
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
  return (
    <div className="rounded-xl border border-amber-200/16 bg-black/35 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.24em] text-zinc-500">Proposal</p>
          <h3 className="mt-1 text-lg text-white">{proposal.summary}</h3>
        </div>
        <Pill tone={tone}>{proposal.riskLevel}</Pill>
      </div>

      <div className="mt-4 grid gap-3 text-sm text-zinc-300">
        <ProposalRow label="Action" value={proposal.plan.actionType} />
        <ProposalRow label="Route" value={proposal.route} />
        {proposal.plan.amount ? <ProposalRow label="Amount" value={proposal.plan.amount} /> : null}
        {proposal.plan.mint ? <ProposalRow label="Mint" value={proposal.plan.mint} copy /> : null}
      </div>

      {proposal.accountsTouched.length > 0 ? (
        <ProposalList title="Accounts Touched" items={proposal.accountsTouched} />
      ) : null}
      {proposal.prerequisites.length > 0 ? (
        <ProposalList title="Prerequisites" items={proposal.prerequisites} danger />
      ) : null}
      {proposal.warnings.length > 0 ? <ProposalList title="Warnings" items={proposal.warnings} /> : null}

      <div className="mt-4 rounded-lg border border-white/8 bg-white/[0.03] p-3 text-xs text-zinc-400">
        {proposal.simulation.summary}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <LuxuryButton variant="secondary" onClick={onReject} disabled={isExecuting}>
          Reject
        </LuxuryButton>
        <LuxuryButton onClick={onApprove} isLoading={isExecuting} disabled={proposal.blocked}>
          Approve & Sign
        </LuxuryButton>
      </div>
    </div>
  );
}

function ProposalRow({ label, value, copy = false }: { label: string; value: string; copy?: boolean }) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-3 border-b border-white/8 pb-2">
      <span className="text-xs uppercase tracking-[0.16em] text-zinc-600">{label}</span>
      <span className="flex min-w-0 items-center gap-2 text-right font-mono text-xs text-zinc-300">
        <span className="truncate">{value}</span>
        {copy ? <CopyButton value={value} label={`Copy ${label}`} /> : null}
      </span>
    </div>
  );
}

function ProposalList({ title, items, danger = false }: { title: string; items: string[]; danger?: boolean }) {
  return (
    <div className="mt-4">
      <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">{title}</p>
      <div className="mt-2 space-y-2">
        {items.map((item) => (
          <p key={item} className={cn('rounded-md border px-3 py-2 text-xs', danger ? 'border-rose-300/15 bg-rose-400/8 text-rose-100' : 'border-white/8 bg-white/[0.03] text-zinc-400')}>
            {item}
          </p>
        ))}
      </div>
    </div>
  );
}

export function AgentExecutionTimeline({ lastSignature }: { lastSignature: string | null }) {
  return (
    <div className="rounded-xl border border-white/8 bg-black/30 p-4">
      <p className="text-[10px] uppercase tracking-[0.24em] text-zinc-500">Execution</p>
      <p className="mt-2 text-sm text-zinc-300">
        No active proposal. Prepared actions wait here until you approve or reject them.
      </p>
      {lastSignature ? (
        <div className="mt-3 flex min-w-0 items-center gap-2 rounded-md border border-emerald-300/15 bg-emerald-300/8 p-2">
          <span className="min-w-0 truncate font-mono text-xs text-emerald-100">{lastSignature}</span>
          <CopyButton value={lastSignature} label="Copy signature" />
        </div>
      ) : null}
    </div>
  );
}

export function AgentStateInspector({
  lines,
  context,
}: {
  lines: string[];
  context: AgentToolContext | null;
}) {
  return (
    <div className="rounded-xl border border-white/8 bg-black/30 p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[10px] uppercase tracking-[0.24em] text-zinc-500">State</p>
        <Pill tone={context?.walletConnected ? 'green' : 'default'}>
          {context?.walletConnected ? 'Wallet connected' : 'Wallet needed'}
        </Pill>
      </div>
      <div className="mt-3 space-y-2">
        {lines.map((line) => (
          <p key={line} className="text-xs text-zinc-400">{line}</p>
        ))}
      </div>
    </div>
  );
}

function cleanError(error: any) {
  const message = error?.message || 'Action failed.';
  if (message.length > 240) return `${message.slice(0, 237)}...`;
  return message;
}
