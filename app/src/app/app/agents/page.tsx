'use client';

import { useEffect, useState } from 'react';
import { useWalletContext } from '@/contexts/WalletContext';
import { useWallet } from '@solana/wallet-adapter-react';
import { GlassPanel, SectionHeader, Pill, truncateAddress } from '@/components/ui/luxury';

interface AgentRow {
  address: string;
  name: string;
  status: string;
}

export default function AgentsPage() {
  const { sdk } = useWalletContext();
  const { publicKey } = useWallet();
  const [agents, setAgents] = useState<AgentRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!sdk || !publicKey) return;
    setLoading(true);
    sdk.agents
      .listAgents(publicKey)
      .then((list) => {
        setAgents(
          list.map((a) => ({
            address: a.pubkey.toBase58(),
            name: a.label || 'Unnamed Agent',
            status: a.revoked ? 'Revoked' : a.frozen ? 'Frozen' : 'Active',
          }))
        );
      })
      .catch(() => setAgents([]))
      .finally(() => setLoading(false));
  }, [sdk, publicKey]);

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Agent Management"
        title="Your Agents"
        subtitle="Hierarchical agents spawned from your treasury. Each agent has its own balance, policy, and counters."
      />

      <GlassPanel className="p-6">
        {loading ? (
          <p className="text-sm text-zinc-400">Loading agents...</p>
        ) : agents.length === 0 ? (
          <div className="space-y-3">
            <p className="text-sm text-zinc-300">No agents found.</p>
            <p className="text-xs text-zinc-500">
              Agents are spawned from the treasury dashboard. Once created, they appear here with
              their policy and balance status.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {agents.map((agent) => (
              <div
                key={agent.address}
                className="flex flex-col gap-2 rounded-xl border border-white/6 bg-white/[0.02] p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm text-white">{agent.name}</p>
                    <Pill tone={agent.status === 'Active' ? 'green' : agent.status === 'Frozen' ? 'amber' : 'red'}>
                      {agent.status}
                    </Pill>
                  </div>
                  <p className="mt-1 font-mono text-xs text-zinc-500">
                    {truncateAddress(agent.address, 14, 14)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </GlassPanel>
    </div>
  );
}
