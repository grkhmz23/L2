'use client';

import { useWallet } from '@solana/wallet-adapter-react';
import { UserStatus } from '@/components/UserStatus';
import { BalanceList } from '@/components/BalanceList';
import { ActionPanel } from '@/components/ActionPanel';

export default function TreasuryPage() {
  const { connected } = useWallet();

  if (!connected) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="text-center">
          <p className="text-lg text-white">Connect your wallet to open the treasury.</p>
          <p className="mt-2 text-sm text-zinc-500">
            The Sable console requires a Solana wallet to read balances, manage agents, and interact with tasks.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid flex-1 gap-6 lg:grid-cols-12">
        <div className="space-y-6 lg:col-span-4">
          <UserStatus />
          <BalanceList />
        </div>

        <div className="lg:col-span-8">
          <ActionPanel />
        </div>
      </div>
    </div>
  );
}
