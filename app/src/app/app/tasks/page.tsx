'use client';

import { useEffect, useState } from 'react';
import { useWalletContext } from '@/contexts/WalletContext';
import { useWallet } from '@solana/wallet-adapter-react';
import { GlassPanel, SectionHeader, Pill, truncateAddress } from '@/components/ui/luxury';

interface TaskRow {
  address: string;
  title: string;
  state: string;
  budget: string;
}

export default function TasksPage() {
  const { sdk } = useWalletContext();
  const { publicKey } = useWallet();
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!sdk || !publicKey) return;
    setLoading(true);
    sdk.auctions
      .listTasks({ poster: publicKey })
      .then((list) => {
        setTasks(
          list.map((t) => ({
            address: t.pubkey.toBase58(),
            title: `Task #${t.taskId.toString()}`,

            state: t.state,
            budget: t.budget?.toString() || '0',
          }))
        );
      })
      .catch(() => setTasks([]))
      .finally(() => setLoading(false));
  }, [sdk, publicKey]);

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Auction Marketplace"
        title="Your Tasks"
        subtitle="Sealed-bid tasks posted by you or your agents. Tasks progress through Open → Revealing → Settled states."
      />

      <GlassPanel className="p-6">
        {loading ? (
          <p className="text-sm text-zinc-400">Loading tasks...</p>
        ) : tasks.length === 0 ? (
          <div className="space-y-3">
            <p className="text-sm text-zinc-300">No tasks found.</p>
            <p className="text-xs text-zinc-500">
              Tasks are created from the treasury dashboard or via SDK. Once posted, they appear
              here with bid and settlement status.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {tasks.map((task) => (
              <div
                key={task.address}
                className="flex flex-col gap-2 rounded-xl border border-white/6 bg-white/[0.02] p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm text-white">{task.title}</p>
                    <Pill tone={task.state === 'open' ? 'green' : task.state === 'revealing' ? 'amber' : 'default'}>
                      {task.state}
                    </Pill>
                  </div>
                  <p className="mt-1 font-mono text-xs text-zinc-500">
                    {truncateAddress(task.address, 14, 14)}
                  </p>
                </div>
                <div className="text-left sm:text-right">
                  <p className="text-sm text-zinc-300">{task.budget} lamports</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </GlassPanel>
    </div>
  );
}
