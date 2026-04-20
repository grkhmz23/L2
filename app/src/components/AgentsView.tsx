'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useWalletContext } from '@/contexts/WalletContext';
import { useWallet } from '@solana/wallet-adapter-react';
import { PublicKey, Keypair } from '@solana/web3.js';
import { BN } from '@coral-xyz/anchor';
import type { AgentSnapshot, SpendPolicy } from '@sable/sdk';
import {
  GlassPanel,
  LuxuryButton,
  LuxuryInput,
  Pill,
  SectionHeader,
  truncateAddress,
  cn,
} from '@/components/ui/luxury';
import toast from 'react-hot-toast';

interface TreeNode {
  agent: AgentSnapshot;
  children: TreeNode[];
  depth: number;
}

export function AgentsView() {
  const { sdk, solanaSdk } = useWalletContext();
  const { publicKey, connected } = useWallet();
  const [agents, setAgents] = useState<AgentSnapshot[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<AgentSnapshot | null>(null);
  const [userMints, setUserMints] = useState<PublicKey[]>([]);
  const [agentBalances, setAgentBalances] = useState<Map<string, { mint: PublicKey; amount: string }[]>>(new Map());

  // Modals
  const [showSpawn, setShowSpawn] = useState(false);
  const [showPolicy, setShowPolicy] = useState(false);
  const [showFund, setShowFund] = useState(false);
  const [showDefund, setShowDefund] = useState(false);

  const fetchAgents = useCallback(async () => {
    if (!sdk || !publicKey) return;
    setLoading(true);
    try {
      const list = await sdk.agents.listAgents(publicKey);
      setAgents(list);
      if (selectedAgent) {
        const updated = list.find((a) => a.pubkey.equals(selectedAgent.pubkey));
        if (updated) setSelectedAgent(updated);
      }
    } catch (error: any) {
      console.error('Error fetching agents:', error);
      toast.error(error.message || 'Failed to load agents');
    } finally {
      setLoading(false);
    }
  }, [sdk, publicKey, selectedAgent]);

  const fetchUserMints = useCallback(async () => {
    if (!sdk || !publicKey) return;
    try {
      const balances = await sdk.getAllUserBalances(publicKey);
      const mints = balances.map((b: any) => b.account.mint as PublicKey);
      setUserMints([...new Map(mints.map((m) => [m.toBase58(), m])).values()]);
    } catch {
      setUserMints([]);
    }
  }, [sdk, publicKey]);

  const fetchAgentBalances = useCallback(async (agent: PublicKey) => {
    if (!sdk) return;
    const results: { mint: PublicKey; amount: string }[] = [];
    for (const mint of userMints) {
      try {
        const bal = await sdk.agents.getAgentBalance(agent, mint);
        if (bal && bal.amount.toString() !== '0') {
          results.push({ mint, amount: bal.amount.toString() });
        }
      } catch {
        // No balance for this mint
      }
    }
    setAgentBalances((prev) => {
      const next = new Map(prev);
      next.set(agent.toBase58(), results);
      return next;
    });
  }, [sdk, userMints]);

  useEffect(() => {
    fetchAgents();
    fetchUserMints();
  }, [fetchAgents, fetchUserMints]);

  useEffect(() => {
    if (selectedAgent) {
      fetchAgentBalances(selectedAgent.pubkey);
    }
  }, [selectedAgent, fetchAgentBalances]);

  // Build tree
  const tree = useMemo(() => {
    if (!publicKey) return [];

    const byParent = new Map<string, AgentSnapshot[]>();
    for (const agent of agents) {
      const parentKey = agent.parent.toBase58();
      if (!byParent.has(parentKey)) byParent.set(parentKey, []);
      byParent.get(parentKey)!.push(agent);
    }

    const build = (parentKey: string, depth: number): TreeNode[] => {
      const children = byParent.get(parentKey) || [];
      return children.map((agent) => ({
        agent,
        children: build(agent.pubkey.toBase58(), depth + 1),
        depth,
      }));
    };

    return build(publicKey.toBase58(), 1);
  }, [agents, publicKey]);

  const totalBalanceForAgent = (agent: PublicKey) => {
    const bals = agentBalances.get(agent.toBase58()) || [];
    return bals.reduce((sum, b) => sum + Number(b.amount), 0).toLocaleString();
  };

  if (!connected) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-lg text-white">Connect your wallet to manage agents.</p>
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-12">
      {/* Tree pane */}
      <div className="lg:col-span-4">
        <GlassPanel className="p-5">
          <SectionHeader
            eyebrow="Hierarchy"
            title="Agent Tree"
            subtitle="Expand nodes to explore your agent hierarchy."
            action={
              <LuxuryButton
                variant="secondary"
                className="px-3 py-2 text-[10px]"
                onClick={() => {
                  setSelectedAgent(null);
                  setShowSpawn(true);
                }}
              >
                + Spawn
              </LuxuryButton>
            }
          />

          <div className="mt-5 space-y-1">
            {loading ? (
              <p className="text-sm text-zinc-400">Loading agents...</p>
            ) : agents.length === 0 ? (
              <div className="rounded-xl border border-white/8 bg-black/30 p-4">
                <p className="text-sm text-zinc-300">No agents yet.</p>
                <p className="mt-1 text-xs text-zinc-500">Spawn your first agent from the treasury.</p>
              </div>
            ) : (
              <>
                <TreeNodeItem
                  label="UserState (Root)"
                  address={publicKey?.toBase58() || ''}
                  status="Root"
                  depth={0}
                  isSelected={selectedAgent === null}
                  onClick={() => setSelectedAgent(null)}
                />
                {tree.map((node) => (
                  <TreeBranch
                    key={node.agent.pubkey.toBase58()}
                    node={node}
                    selectedAgent={selectedAgent}
                    onSelect={setSelectedAgent}
                    totalBalanceForAgent={totalBalanceForAgent}
                  />
                ))}
              </>
            )}
          </div>
        </GlassPanel>
      </div>

      {/* Detail pane */}
      <div className="lg:col-span-8">
        {selectedAgent ? (
          <AgentDetailPanel
            agent={selectedAgent}
            balances={agentBalances.get(selectedAgent.pubkey.toBase58()) || []}
            onRefresh={fetchAgents}
            onSpawnSub={() => setShowSpawn(true)}
            onFund={() => setShowFund(true)}
            onDefund={() => setShowDefund(true)}
            onEditPolicy={() => setShowPolicy(true)}
          />
        ) : (
          <GlassPanel className="p-6">
            <SectionHeader
              eyebrow="Detail"
              title="Select an Agent"
              subtitle="Click an agent in the tree to view its details, balances, policy, and actions."
            />
            <div className="mt-6 rounded-xl border border-white/8 bg-black/30 p-5">
              <p className="text-sm text-zinc-300">No agent selected.</p>
              <p className="mt-2 text-xs text-zinc-500">
                Select an agent from the tree to manage its policy, balances, and lifecycle.
              </p>
            </div>
          </GlassPanel>
        )}
      </div>

      {/* Modals */}
      {showSpawn && (
        <SpawnAgentModal
          parentAgent={selectedAgent}
          onClose={() => setShowSpawn(false)}
          onComplete={fetchAgents}
        />
      )}
      {showPolicy && selectedAgent && (
        <PolicyEditorModal
          agent={selectedAgent}
          onClose={() => setShowPolicy(false)}
          onComplete={fetchAgents}
        />
      )}
      {showFund && selectedAgent && (
        <FundAgentModal
          agent={selectedAgent}
          userMints={userMints}
          mode="fund"
          onClose={() => setShowFund(false)}
          onComplete={() => {
            fetchAgents();
            if (selectedAgent) fetchAgentBalances(selectedAgent.pubkey);
          }}
        />
      )}
      {showDefund && selectedAgent && (
        <FundAgentModal
          agent={selectedAgent}
          userMints={userMints}
          mode="defund"
          onClose={() => setShowDefund(false)}
          onComplete={() => {
            fetchAgents();
            if (selectedAgent) fetchAgentBalances(selectedAgent.pubkey);
          }}
        />
      )}
    </div>
  );
}

/* ───────── Tree Components ───────── */

function TreeBranch({
  node,
  selectedAgent,
  onSelect,
  totalBalanceForAgent,
  indent = 1,
}: {
  node: TreeNode;
  selectedAgent: AgentSnapshot | null;
  onSelect: (a: AgentSnapshot) => void;
  totalBalanceForAgent: (a: PublicKey) => string;
  indent?: number;
}) {
  const [expanded, setExpanded] = useState(true);
  const isSelected = selectedAgent?.pubkey.equals(node.agent.pubkey) ?? false;

  return (
    <div>
      <TreeNodeItem
        label={node.agent.label || 'Unnamed Agent'}
        address={node.agent.pubkey.toBase58()}
        status={node.agent.revoked ? 'Revoked' : node.agent.frozen ? 'Frozen' : 'Active'}
        depth={node.depth}
        isSelected={isSelected}
        onClick={() => onSelect(node.agent)}
        expandable={node.children.length > 0}
        expanded={expanded}
        onToggle={() => setExpanded(!expanded)}
        indent={indent}
        extra={`Bal: ${totalBalanceForAgent(node.agent.pubkey)}`}
      />
      {expanded &&
        node.children.map((child) => (
          <TreeBranch
            key={child.agent.pubkey.toBase58()}
            node={child}
            selectedAgent={selectedAgent}
            onSelect={onSelect}
            totalBalanceForAgent={totalBalanceForAgent}
            indent={indent + 1}
          />
        ))}
    </div>
  );
}

function TreeNodeItem({
  label,
  address,
  status,
  depth,
  isSelected,
  onClick,
  expandable,
  expanded,
  onToggle,
  indent = 0,
  extra,
}: {
  label: string;
  address: string;
  status: string;
  depth: number;
  isSelected: boolean;
  onClick: () => void;
  expandable?: boolean;
  expanded?: boolean;
  onToggle?: () => void;
  indent?: number;
  extra?: string;
}) {
  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-xl px-3 py-2.5 transition',
        isSelected ? 'bg-white/[0.05] text-amber-100' : 'text-zinc-300 hover:bg-white/[0.03]'
      )}
      style={{ paddingLeft: `${12 + indent * 16}px` }}
    >
      {expandable ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggle?.();
          }}
          className="text-[10px] text-zinc-500 hover:text-zinc-200"
        >
          {expanded ? '▼' : '▶'}
        </button>
      ) : (
        <span className="w-3" />
      )}
      <button type="button" onClick={onClick} className="flex-1 text-left">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium">{label}</span>
          <Pill
            tone={
              status === 'Active' || status === 'Root'
                ? 'green'
                : status === 'Frozen'
                ? 'amber'
                : 'red'
            }
          >
            {status}
          </Pill>
        </div>
        <div className="mt-0.5 flex items-center gap-2">
          <span className="font-mono text-[10px] text-zinc-500">
            {truncateAddress(address, 10, 6)}
          </span>
          {extra ? <span className="text-[10px] text-zinc-600">{extra}</span> : null}
        </div>
      </button>
    </div>
  );
}

/* ───────── Agent Detail Panel ───────── */

function AgentDetailPanel({
  agent,
  balances,
  onRefresh,
  onSpawnSub,
  onFund,
  onDefund,
  onEditPolicy,
}: {
  agent: AgentSnapshot;
  balances: { mint: PublicKey; amount: string }[];
  onRefresh: () => void;
  onSpawnSub: () => void;
  onFund: () => void;
  onDefund: () => void;
  onEditPolicy: () => void;
}) {
  const { sdk } = useWalletContext();
  const [isActionLoading, setIsActionLoading] = useState<string | null>(null);

  const handleFreeze = async () => {
    if (!sdk) return;
    setIsActionLoading('freeze');
    try {
      await sdk.agents.freezeAgent({ agent: agent.pubkey });
      toast.success('Agent frozen');
      onRefresh();
    } catch (error: any) {
      toast.error(error.message || 'Freeze failed');
    } finally {
      setIsActionLoading(null);
    }
  };

  const handleUnfreeze = async () => {
    if (!sdk) return;
    setIsActionLoading('unfreeze');
    try {
      await sdk.agents.unfreezeAgent({ agent: agent.pubkey });
      toast.success('Agent unfrozen');
      onRefresh();
    } catch (error: any) {
      toast.error(error.message || 'Unfreeze failed');
    } finally {
      setIsActionLoading(null);
    }
  };

  const handleRevoke = async () => {
    if (!sdk) return;
    if (!window.confirm('Revoking an agent is PERMANENT and cannot be undone. Continue?')) return;
    setIsActionLoading('revoke');
    try {
      await sdk.agents.revokeAgent({ agent: agent.pubkey });
      toast.success('Agent revoked');
      onRefresh();
    } catch (error: any) {
      toast.error(error.message || 'Revoke failed');
    } finally {
      setIsActionLoading(null);
    }
  };

  const formatPolicy = () => {
    const p = agent.policy;
    const parts: string[] = [];
    if (p.perTxLimit.gt(new BN(0))) parts.push(`Per-tx: ${p.perTxLimit.toString()}`);
    if (p.dailyLimit.gt(new BN(0))) parts.push(`Daily: ${p.dailyLimit.toString()}`);
    if (p.totalLimit.gt(new BN(0))) parts.push(`Total: ${p.totalLimit.toString()}`);
    parts.push(`Counterparty: ${p.counterpartyMode}`);
    if (p.expiresAt.gt(new BN(0))) {
      const date = new Date(p.expiresAt.toNumber() * 1000);
      parts.push(`Expires: ${date.toLocaleDateString()}`);
    }
    return parts;
  };

  return (
    <div className="space-y-6">
      <GlassPanel className="p-6">
        <SectionHeader
          eyebrow="Agent Detail"
          title={agent.label || 'Unnamed Agent'}
          action={
            <div className="flex flex-wrap gap-2">
              <LuxuryButton variant="secondary" className="px-3 py-2 text-[10px]" onClick={onFund}>
                Fund
              </LuxuryButton>
              <LuxuryButton variant="secondary" className="px-3 py-2 text-[10px]" onClick={onDefund}>
                Defund
              </LuxuryButton>
              <LuxuryButton variant="secondary" className="px-3 py-2 text-[10px]" onClick={onSpawnSub}>
                Spawn Sub
              </LuxuryButton>
            </div>
          }
        />

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <InfoRow label="Address" value={truncateAddress(agent.pubkey.toBase58(), 16, 14)} mono />
          <InfoRow label="Owner" value={truncateAddress(agent.owner.toBase58(), 16, 14)} mono />
          <InfoRow label="Parent" value={truncateAddress(agent.parent.toBase58(), 16, 14)} mono />
          <InfoRow label="Root User" value={truncateAddress(agent.rootUser.toBase58(), 16, 14)} mono />
          <InfoRow label="Nonce" value={String(agent.nonce)} />
          <InfoRow label="Children" value={String(agent.childCount)} />
          <InfoRow label="Status">
            <div className="flex gap-2">
              {agent.frozen ? <Pill tone="amber">Frozen</Pill> : null}
              {agent.revoked ? <Pill tone="red">Revoked</Pill> : null}
              {!agent.frozen && !agent.revoked ? <Pill tone="green">Active</Pill> : null}
            </div>
          </InfoRow>
          <InfoRow label="Tasks" value={agent.taskCount.toString()} />
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          {agent.frozen ? (
            <LuxuryButton
              variant="secondary"
              onClick={handleUnfreeze}
              isLoading={isActionLoading === 'unfreeze'}
              className="px-4 py-2"
            >
              Unfreeze
            </LuxuryButton>
          ) : (
            <LuxuryButton
              variant="secondary"
              onClick={handleFreeze}
              isLoading={isActionLoading === 'freeze'}
              className="px-4 py-2"
            >
              Freeze
            </LuxuryButton>
          )}
          <LuxuryButton
            variant="secondary"
            onClick={onEditPolicy}
            className="px-4 py-2"
          >
            Edit Policy
          </LuxuryButton>
          <LuxuryButton
            variant="danger"
            onClick={handleRevoke}
            isLoading={isActionLoading === 'revoke'}
            className="px-4 py-2"
          >
            Revoke
          </LuxuryButton>
        </div>
      </GlassPanel>

      <GlassPanel className="p-6">
        <SectionHeader eyebrow="Balances" title="Agent Balances" />
        <div className="mt-4 space-y-2">
          {balances.length === 0 ? (
            <p className="text-sm text-zinc-400">No balances found for this agent.</p>
          ) : (
            balances.map((b) => (
              <div
                key={b.mint.toBase58()}
                className="flex items-center justify-between rounded-xl border border-white/6 bg-white/[0.02] px-4 py-3"
              >
                <span className="font-mono text-xs text-zinc-300">
                  {truncateAddress(b.mint.toBase58(), 10, 10)}
                </span>
                <span className="text-sm text-white">{b.amount}</span>
              </div>
            ))
          )}
        </div>
      </GlassPanel>

      <GlassPanel className="p-6">
        <SectionHeader
          eyebrow="Policy"
          title="Spend Policy"
          action={
            <LuxuryButton variant="secondary" className="px-3 py-2 text-[10px]" onClick={onEditPolicy}>
              Edit
            </LuxuryButton>
          }
        />
        <div className="mt-4 flex flex-wrap gap-2">
          {formatPolicy().map((part) => (
            <Pill key={part}>{part}</Pill>
          ))}
        </div>
        {agent.policy.allowedMints.some((m) => !m.equals(PublicKey.default)) ? (
          <div className="mt-3">
            <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">Allowed Mints</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {agent.policy.allowedMints
                .filter((m) => !m.equals(PublicKey.default))
                .map((m) => (
                  <span key={m.toBase58()} className="font-mono text-xs text-zinc-400">
                    {truncateAddress(m.toBase58(), 8, 6)}
                  </span>
                ))}
            </div>
          </div>
        ) : null}
      </GlassPanel>
    </div>
  );
}

function InfoRow({
  label,
  value,
  mono,
  children,
}: {
  label: string;
  value?: string;
  mono?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-white/6 bg-white/[0.02] px-4 py-3">
      <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">{label}</p>
      {children ? (
        <div className="mt-1">{children}</div>
      ) : (
        <p className={`mt-1 text-sm text-white ${mono ? 'font-mono' : ''}`}>{value}</p>
      )}
    </div>
  );
}

/* ───────── Spawn Agent Modal ───────── */

function SpawnAgentModal({
  parentAgent,
  onClose,
  onComplete,
}: {
  parentAgent: AgentSnapshot | null;
  onClose: () => void;
  onComplete: () => void;
}) {
  const { sdk } = useWalletContext();
  const { publicKey } = useWallet();
  const [label, setLabel] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [keypair, setKeypair] = useState<Keypair | null>(null);
  const [downloaded, setDownloaded] = useState(false);

  const generateKeypair = () => {
    const kp = Keypair.generate();
    setKeypair(kp);
    setDownloaded(false);
  };

  const downloadKeypair = () => {
    if (!keypair) return;
    const blob = new Blob(
      [JSON.stringify(Array.from(keypair.secretKey))],
      { type: 'application/json' }
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `agent-${label || 'keypair'}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setDownloaded(true);
  };

  const handleSpawn = async () => {
    if (!sdk || !publicKey || !label.trim()) return;
    if (!keypair) {
      toast.error('Generate a keypair first');
      return;
    }
    if (!downloaded) {
      toast.error('Download the keypair before spawning');
      return;
    }

    setIsLoading(true);
    try {
      const parentKind = parentAgent ? 'agent' : 'user';
      const parent = parentAgent ? parentAgent.pubkey : publicKey;

      await sdk.agents.spawnAgent({
        parentKind: parentKind as any,
        parent,
        label: label.trim(),
      });
      toast.success('Agent spawned successfully');
      setLabel('');
      setKeypair(null);
      setDownloaded(false);
      onComplete();
      onClose();
    } catch (error: any) {
      console.error('Spawn error:', error);
      toast.error(error.message || 'Failed to spawn agent');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/75 backdrop-blur-xl" onClick={onClose} />
      <GlassPanel className="relative w-full max-w-lg p-6 md:p-8" highlight>
        <SectionHeader
          eyebrow="Agent Lifecycle"
          title="Spawn Agent"
          subtitle={
            parentAgent
              ? `Spawn a sub-agent under "${parentAgent.label}"`
              : 'Spawn a top-level agent under your UserState'
          }
          action={
            <LuxuryButton variant="ghost" className="px-3 py-2" onClick={onClose}>
              Close
            </LuxuryButton>
          }
        />

        <div className="mt-6 space-y-4">
          <LuxuryInput
            label="Agent Label"
            placeholder="e.g. Marketing Bot"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            maxLength={32}
          />

          <div className="rounded-2xl border border-amber-300/15 bg-amber-300/5 p-4">
            <p className="text-[10px] uppercase tracking-[0.2em] text-amber-200/70">Keypair</p>
            <p className="mt-2 text-xs text-amber-100/80">
              This keypair controls the agent's spending. Store securely.
            </p>
            {keypair ? (
              <div className="mt-3 space-y-2">
                <p className="font-mono text-xs text-zinc-300">
                  Pubkey: {truncateAddress(keypair.publicKey.toBase58(), 16, 14)}
                </p>
                <div className="flex gap-2">
                  <LuxuryButton
                    variant="secondary"
                    className="px-3 py-2 text-[10px]"
                    onClick={downloadKeypair}
                  >
                    {downloaded ? 'Downloaded ✓' : 'Download Keypair'}
                  </LuxuryButton>
                  <LuxuryButton
                    variant="ghost"
                    className="px-3 py-2 text-[10px]"
                    onClick={generateKeypair}
                  >
                    Regenerate
                  </LuxuryButton>
                </div>
              </div>
            ) : (
              <LuxuryButton
                variant="secondary"
                className="mt-3 px-4 py-2 text-[10px]"
                onClick={generateKeypair}
              >
                Generate Keypair
              </LuxuryButton>
            )}
          </div>
        </div>

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <LuxuryButton variant="secondary" onClick={onClose} disabled={isLoading}>
            Cancel
          </LuxuryButton>
          <LuxuryButton
            onClick={handleSpawn}
            isLoading={isLoading}
            disabled={!label.trim() || !keypair || !downloaded}
          >
            Spawn Agent
          </LuxuryButton>
        </div>
      </GlassPanel>
    </div>
  );
}

/* ───────── Policy Editor Modal ───────── */

function PolicyEditorModal({
  agent,
  onClose,
  onComplete,
}: {
  agent: AgentSnapshot;
  onClose: () => void;
  onComplete: () => void;
}) {
  const { sdk } = useWalletContext();
  const [isLoading, setIsLoading] = useState(false);

  const [perTxLimit, setPerTxLimit] = useState(agent.policy.perTxLimit.toString());
  const [dailyLimit, setDailyLimit] = useState(agent.policy.dailyLimit.toString());
  const [totalLimit, setTotalLimit] = useState(agent.policy.totalLimit.toString());
  const [counterpartyMode, setCounterpartyMode] = useState(agent.policy.counterpartyMode);
  const [allowedMints, setAllowedMints] = useState(
    agent.policy.allowedMints
      .filter((m) => !m.equals(PublicKey.default))
      .map((m) => m.toBase58())
      .join(', ')
  );
  const [expiresAt, setExpiresAt] = useState(
    agent.policy.expiresAt.gt(new BN(0))
      ? new Date(agent.policy.expiresAt.toNumber() * 1000).toISOString().slice(0, 16)
      : ''
  );

  const handleSave = async () => {
    if (!sdk) return;
    setIsLoading(true);
    try {
      const mints = allowedMints
        .split(/[,\s]+/)
        .map((s) => s.trim())
        .filter((s) => s.length > 0)
        .map((s) => new PublicKey(s));

      if (mints.length > 4) {
        toast.error('Maximum 4 allowed mints');
        setIsLoading(false);
        return;
      }

      const policy: SpendPolicy = {
        perTxLimit: new BN(perTxLimit || '0'),
        dailyLimit: new BN(dailyLimit || '0'),
        totalLimit: new BN(totalLimit || '0'),
        counterpartyMode,
        allowedCounterparties: [],
        allowedMints: mints,
        expiresAt: expiresAt ? new BN(Math.floor(new Date(expiresAt).getTime() / 1000)) : new BN(0),
      };

      await sdk.agents.setPolicy({ agent: agent.pubkey, policy });
      toast.success('Policy updated');
      onComplete();
      onClose();
    } catch (error: any) {
      console.error('Policy error:', error);
      toast.error(error.message || 'Failed to update policy');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/75 backdrop-blur-xl" onClick={onClose} />
      <GlassPanel className="relative w-full max-w-lg p-6 md:p-8" highlight>
        <SectionHeader
          eyebrow="Policy"
          title="Edit Spend Policy"
          subtitle={`Update constraints for "${agent.label}"`}
          action={
            <LuxuryButton variant="ghost" className="px-3 py-2" onClick={onClose}>
              Close
            </LuxuryButton>
          }
        />

        <div className="mt-6 space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <LuxuryInput
              label="Per-Tx Limit"
              type="number"
              placeholder="0"
              value={perTxLimit}
              onChange={(e) => setPerTxLimit(e.target.value)}
            />
            <LuxuryInput
              label="Daily Limit"
              type="number"
              placeholder="0"
              value={dailyLimit}
              onChange={(e) => setDailyLimit(e.target.value)}
            />
            <LuxuryInput
              label="Total Limit"
              type="number"
              placeholder="0"
              value={totalLimit}
              onChange={(e) => setTotalLimit(e.target.value)}
            />
          </div>

          <div>
            <p className="mb-2 text-[10px] uppercase tracking-[0.22em] text-zinc-500">Counterparty Mode</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setCounterpartyMode('any')}
                className={cn(
                  'rounded-full px-4 py-2 text-[11px] uppercase tracking-[0.16em] transition',
                  counterpartyMode === 'any'
                    ? 'border border-white/12 bg-white/[0.08] text-amber-100'
                    : 'text-zinc-500 hover:text-zinc-200'
                )}
              >
                Any
              </button>
              <button
                type="button"
                onClick={() => setCounterpartyMode('allowlistOnly')}
                className={cn(
                  'rounded-full px-4 py-2 text-[11px] uppercase tracking-[0.16em] transition',
                  counterpartyMode === 'allowlistOnly'
                    ? 'border border-white/12 bg-white/[0.08] text-amber-100'
                    : 'text-zinc-500 hover:text-zinc-200'
                )}
              >
                Allowlist Only
              </button>
            </div>
          </div>

          <LuxuryInput
            label="Allowed Mints (comma-separated, max 4)"
            placeholder="Mint1, Mint2..."
            value={allowedMints}
            onChange={(e) => setAllowedMints(e.target.value)}
          />

          <LuxuryInput
            label="Expiry"
            type="datetime-local"
            value={expiresAt}
            onChange={(e) => setExpiresAt(e.target.value)}
          />

          <div className="rounded-2xl border border-white/8 bg-black/35 p-4">
            <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">Preview</p>
            <p className="mt-2 text-sm text-zinc-300">
              This policy allows:{' '}
              {perTxLimit || dailyLimit || totalLimit
                ? `spending capped at ${[perTxLimit && `per-tx ${perTxLimit}`, dailyLimit && `daily ${dailyLimit}`, totalLimit && `total ${totalLimit}`].filter(Boolean).join(', ')}`
                : 'unlimited spending'}
              {counterpartyMode === 'allowlistOnly' ? ' to allowlisted counterparties only' : ' to any counterparty'}
              {allowedMints.trim() ? ` using ${allowedMints.split(/[,\s]+/).filter(s => s.trim()).length} allowed mint(s)` : ''}
              {expiresAt ? ` until ${new Date(expiresAt).toLocaleString()}` : ' with no expiry'}
              .
            </p>
          </div>
        </div>

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <LuxuryButton variant="secondary" onClick={onClose} disabled={isLoading}>
            Cancel
          </LuxuryButton>
          <LuxuryButton onClick={handleSave} isLoading={isLoading}>
            Save Policy
          </LuxuryButton>
        </div>
      </GlassPanel>
    </div>
  );
}

/* ───────── Fund / Defund Agent Modal ───────── */

function FundAgentModal({
  agent,
  userMints,
  mode,
  onClose,
  onComplete,
}: {
  agent: AgentSnapshot;
  userMints: PublicKey[];
  mode: 'fund' | 'defund';
  onClose: () => void;
  onComplete: () => void;
}) {
  const { sdk } = useWalletContext();
  const [mint, setMint] = useState(userMints[0]?.toBase58() || '');
  const [amount, setAmount] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async () => {
    if (!sdk || !mint.trim() || !amount.trim()) return;
    setIsLoading(true);
    try {
      const mintPk = new PublicKey(mint.trim());
      const lamports = Math.floor(parseFloat(amount) * 1e9);
      if (!Number.isFinite(lamports) || lamports <= 0) {
        throw new Error('Invalid amount');
      }

      if (mode === 'fund') {
        await sdk.agents.fundAgent({ agent: agent.pubkey, mint: mintPk, amount: new BN(lamports) });
        toast.success('Agent funded');
      } else {
        await sdk.agents.defundAgent({ agent: agent.pubkey, mint: mintPk, amount: new BN(lamports) });
        toast.success('Agent defunded');
      }
      setAmount('');
      onComplete();
      onClose();
    } catch (error: any) {
      console.error(`${mode} error:`, error);
      toast.error(error.message || `${mode} failed`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/75 backdrop-blur-xl" onClick={onClose} />
      <GlassPanel className="relative w-full max-w-md p-6 md:p-8" highlight>
        <SectionHeader
          eyebrow="Treasury"
          title={mode === 'fund' ? 'Fund Agent' : 'Defund Agent'}
          subtitle={
            mode === 'fund'
              ? `Transfer from your treasury to "${agent.label}"`
              : `Reclaim funds from "${agent.label}" to your treasury`
          }
          action={
            <LuxuryButton variant="ghost" className="px-3 py-2" onClick={onClose}>
              Close
            </LuxuryButton>
          }
        />

        <div className="mt-6 space-y-4">
          <div>
            <p className="mb-2 text-[10px] uppercase tracking-[0.22em] text-zinc-500">Mint</p>
            <select
              value={mint}
              onChange={(e) => setMint(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3 text-sm text-zinc-100 focus:border-[rgba(214,190,112,0.32)] focus:outline-none"
            >
              {userMints.map((m) => (
                <option key={m.toBase58()} value={m.toBase58()}>
                  {truncateAddress(m.toBase58(), 16, 14)}
                </option>
              ))}
            </select>
          </div>
          <LuxuryInput
            label="Amount (raw lamports)"
            type="number"
            placeholder="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <LuxuryButton variant="secondary" onClick={onClose} disabled={isLoading}>
            Cancel
          </LuxuryButton>
          <LuxuryButton onClick={handleSubmit} isLoading={isLoading} disabled={!mint || !amount}>
            {mode === 'fund' ? 'Fund' : 'Defund'}
          </LuxuryButton>
        </div>
      </GlassPanel>
    </div>
  );
}
