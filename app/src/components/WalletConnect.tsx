'use client';

import { WalletMultiButton } from '@/contexts/WalletContext';
import { CopyableAddress, GlassPanel, SableLogo } from '@/components/ui/luxury';
import { useWallet } from '@solana/wallet-adapter-react';

export function WalletConnect() {
  const { connected, publicKey } = useWallet();

  return (
    <div className="space-y-4">
      <GlassPanel className="px-4 py-4 md:px-6 md:py-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <SableLogo />

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center md:items-end">
            {connected && publicKey ? (
              <div className="inline-flex items-center gap-2 rounded-md border border-white/10 bg-white/[0.03] px-2.5 py-1.5">
                <span className="h-2 w-2 rounded-full bg-amber-300 shadow-[0_0_10px_rgba(252,246,186,0.6)]" />
                <CopyableAddress value={publicKey.toBase58()} head={8} tail={6} className="border-0 bg-transparent p-0" />
              </div>
            ) : null}
            <WalletMultiButton className="!h-auto !rounded-full !border !border-white/12 !bg-white/5 !px-4 !py-2 !text-xs !font-medium !text-zinc-100 hover:!bg-white/10" />
          </div>
        </div>
      </GlassPanel>
    </div>
  );
}
