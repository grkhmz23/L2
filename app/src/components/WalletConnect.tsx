'use client';

import { WalletMultiButton } from '@/contexts/WalletContext';
import { GlassPanel, truncateAddress } from '@/components/ui/luxury';
import { useWallet } from '@solana/wallet-adapter-react';

export function WalletConnect() {
  const { connected, publicKey } = useWallet();

  return (
    <div className="space-y-4">
      <GlassPanel className="px-4 py-4 md:px-6 md:py-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div className="relative grid h-10 w-10 place-items-center rounded-full border border-[rgba(214,190,112,0.25)] bg-[radial-gradient(circle,rgba(252,246,186,0.16),rgba(0,0,0,0))]">
              <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle,rgba(191,149,63,0.15),transparent_70%)] blur-md" />
              <span className="relative text-sm tracking-[0.3em] text-amber-100">S</span>
            </div>
            <div>
              <h1 className="text-lg text-white md:text-xl">Sable</h1>
              <p className="text-[10px] uppercase tracking-[0.3em] text-zinc-500">
                Agent Treasury
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center md:items-end">
            {connected && publicKey ? (
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-2">
                <span className="h-2 w-2 rounded-full bg-amber-300 shadow-[0_0_10px_rgba(252,246,186,0.6)]" />
                <span className="font-mono text-xs text-zinc-300">
                  {truncateAddress(publicKey.toBase58(), 10, 8)}
                </span>
              </div>
            ) : null}
            <WalletMultiButton className="!h-auto !rounded-full !border !border-white/12 !bg-white/5 !px-4 !py-2 !text-xs !font-medium !text-zinc-100 hover:!bg-white/10" />
          </div>
        </div>
      </GlassPanel>
    </div>
  );
}
