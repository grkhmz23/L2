'use client';

import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@/contexts/WalletContext';
import { CopyableAddress, Pill } from '@/components/ui/luxury';

export function AppHeader() {
  const { connected, publicKey } = useWallet();

  return (
    <header className="flex min-w-0 items-center justify-between gap-4 px-4 py-3 md:px-6 lg:px-8">
      <div className="flex items-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/sable-logo.png"
          alt="Sable"
          className="h-8 w-auto object-contain md:h-9"
        />
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
