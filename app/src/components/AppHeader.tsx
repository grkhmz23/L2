'use client';

import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton, useWalletContext } from '@/contexts/WalletContext';
import { CopyableAddress, Pill, SableLogo } from '@/components/ui/luxury';

export function AppHeader() {
  const { connected, publicKey } = useWallet();
  const { routingMode, setRoutingMode } = useWalletContext();

  return (
    <header className="flex min-w-0 items-center justify-between gap-4 px-4 py-4 md:px-6 lg:px-8">
      <div className="lg:hidden">
        <SableLogo />
      </div>

      <div className="hidden items-center gap-3 lg:flex">
        {/* Routing mode toggle */}
        <div className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.03] p-0.5">
          <button
            onClick={() => setRoutingMode('solana')}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              routingMode === 'solana'
                ? 'bg-white/10 text-amber-100'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
            title="Use Solana base layer RPC"
          >
            L1
          </button>
          <button
            onClick={() => setRoutingMode('er')}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              routingMode === 'er'
                ? 'bg-white/10 text-amber-100'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
            title="Use Magic Router endpoint when configured"
          >
            ER
          </button>
        </div>
        {routingMode === 'er' && (
          <span className="text-[10px] text-zinc-500">Magic Router endpoint</span>
        )}
      </div>

      <div className="flex min-w-0 items-center gap-2 sm:gap-3">
        <Pill tone="amber">Devnet</Pill>
        {connected && publicKey ? (
          <div className="hidden items-center gap-2 rounded-md border border-white/10 bg-white/[0.03] px-2.5 py-1.5 sm:inline-flex">
            <span className="h-2 w-2 rounded-full bg-amber-300 shadow-[0_0_10px_rgba(252,246,186,0.6)]" />
            <CopyableAddress value={publicKey.toBase58()} head={8} tail={6} className="border-0 bg-transparent p-0" />
          </div>
        ) : null}
        <WalletMultiButton className="!h-auto !rounded-full !border !border-white/12 !bg-white/5 !px-4 !py-2 !text-xs !font-medium !text-zinc-100 hover:!bg-white/10" />
      </div>
    </header>
  );
}
