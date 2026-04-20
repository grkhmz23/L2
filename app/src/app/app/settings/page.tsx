'use client';

import { GlassPanel, SectionHeader, Pill } from '@/components/ui/luxury';
import { env } from '@/utils/env';

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Configuration"
        title="Settings"
        subtitle="Connected RPC endpoints, program ID, and app version."
      />

      <GlassPanel className="p-6">
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-white/8 bg-black/35 p-4">
              <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">Solana RPC</p>
              <p className="mt-2 font-mono text-xs text-zinc-300 break-all">{env.SOLANA_RPC_URL}</p>
            </div>
            <div className="rounded-2xl border border-white/8 bg-black/35 p-4">
              <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">Program ID</p>
              <p className="mt-2 font-mono text-xs text-zinc-300 break-all">{env.SABLE_PROGRAM_ID}</p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-white/8 bg-black/35 p-4">
              <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">MagicBlock RPC</p>
              <p className="mt-2 font-mono text-xs text-zinc-300 break-all">
                {env.MAGICBLOCK_RPC_URL ?? 'Not configured'}
              </p>
            </div>
            <div className="rounded-2xl border border-white/8 bg-black/35 p-4">
              <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">App Version</p>
              <p className="mt-2 text-xs text-zinc-300">0.1.0</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Pill>Sable Console</Pill>
            <Pill tone="amber">Devnet</Pill>
          </div>
        </div>
      </GlassPanel>
    </div>
  );
}
