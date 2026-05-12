'use client';

import { CopyableAddress, GlassPanel, SectionHeader, Pill, LuxuryButton } from '@/components/ui/luxury';
import { useWalletContext } from '@/contexts/WalletContext';
import { env } from '@/utils/env';

export default function SettingsPage() {
  const { refreshUserState } = useWalletContext();

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Configuration"
        title="Settings"
        subtitle="Connected RPC endpoints, program ID, and app version."
      />

      <GlassPanel className="p-6">
        <div className="space-y-6">
          {/* Routing mode — locked to MagicBlock ER */}
          <div className="rounded-lg border border-amber-200/10 bg-amber-200/[0.03] p-4">
            <p className="text-[10px] uppercase tracking-[0.2em] text-amber-200/60">Routing Mode</p>
            <div className="mt-2 flex items-center gap-3">
              <Pill tone="amber">MagicBlock ER</Pill>
              <span className="text-xs text-zinc-400">
                Built for MagicBlock integration. All transactions route through the Magic Router.
              </span>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-lg border border-white/8 bg-black/35 p-4">
              <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">Solana RPC</p>
              <div className="mt-2">
                <CopyableAddress value={env.SOLANA_RPC_URL} label="Copy RPC URL" head={24} tail={14} />
              </div>
            </div>
            <div className="rounded-lg border border-white/8 bg-black/35 p-4">
              <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">Magic Router</p>
              <div className="mt-2">
                <CopyableAddress value={env.MAGIC_ROUTER_URL} label="Copy Magic Router URL" head={24} tail={14} />
              </div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-lg border border-white/8 bg-black/35 p-4">
              <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">Program ID</p>
              <div className="mt-2">
                <CopyableAddress value={env.SABLE_PROGRAM_ID} label="Copy program ID" head={12} tail={10} />
              </div>
            </div>
            <div className="rounded-lg border border-white/8 bg-black/35 p-4">
              <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">App Version</p>
              <p className="mt-2 text-xs text-zinc-300">0.1.0</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Pill>Sable Console</Pill>
            <Pill tone="amber">Devnet</Pill>
            <LuxuryButton variant="secondary" className="px-3 py-1.5 text-xs" onClick={refreshUserState}>
              Refresh State
            </LuxuryButton>
          </div>
        </div>
      </GlassPanel>
    </div>
  );
}
