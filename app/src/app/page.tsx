'use client';

import Link from 'next/link';
import { WalletMultiButton } from '@/contexts/WalletContext';
import { GlassPanel, LuxuryButton, Pill, SableLogo } from '@/components/ui/luxury';
import { useWallet } from '@solana/wallet-adapter-react';

export default function LandingPage() {
  const { connected } = useWallet();

  return (
    <main className="sable-shell">
      <div className="sable-grid-overlay" />
      <div className="sable-noise-overlay" />

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-[1500px] flex-col px-4 py-6 md:px-8 lg:px-12">
        <nav className="flex items-center justify-between">
          <SableLogo />

          <div className="flex items-center gap-3">
            <Link
              href="https://github.com/magicblock-labs/Sable/blob/main/docs/architecture.md"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden text-xs uppercase tracking-[0.18em] text-zinc-400 transition hover:text-zinc-200 sm:inline-block"
            >
              Read the docs
            </Link>
            {connected ? (
              <Link href="/app">
                <LuxuryButton>Open Console</LuxuryButton>
              </Link>
            ) : (
              <WalletMultiButton className="!h-auto !rounded-full !border !border-white/12 !bg-white/5 !px-4 !py-2 !text-xs !font-medium !text-zinc-100 hover:!bg-white/10" />
            )}
          </div>
        </nav>

        <div className="mt-12 grid flex-1 items-start gap-6 md:mt-20 lg:grid-cols-12">
          <GlassPanel className="p-8 lg:col-span-7 lg:p-10" highlight>
            <p className="text-[10px] uppercase tracking-[0.3em] text-amber-200/70">Sable</p>
            <h2 className="mt-4 text-4xl leading-tight text-white md:text-5xl">
              Programmable
              <br />
              agent treasury.
            </h2>
            <p className="mt-5 max-w-2xl text-sm leading-relaxed text-zinc-400 md:text-base">
              Sable is a Solana agent treasury prototype with direct Anchor vault flows,
              MagicBlock ER delegation hooks, hierarchical treasuries, sealed-bid auctions, and an
              x402 demo path.
            </p>

            <div className="mt-6 flex flex-wrap gap-2">
              <Pill tone="amber">Hierarchical agent treasuries</Pill>
              <Pill>ER hooks available</Pill>
              <Pill>Sealed-bid task auctions</Pill>
              <Pill>x402 pay-per-request</Pill>
            </div>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/app">
                <LuxuryButton>Create Treasury</LuxuryButton>
              </Link>
              <Link
                href="https://github.com/magicblock-labs/Sable/blob/main/docs/architecture.md"
                target="_blank"
                rel="noopener noreferrer"
              >
                <LuxuryButton variant="secondary">Read the docs</LuxuryButton>
              </Link>
            </div>
          </GlassPanel>

          <GlassPanel className="p-6 lg:col-span-5">
            <h3 className="text-2xl text-white">How it works</h3>
            <p className="mt-2 text-sm text-zinc-400">
              Connect a wallet to initialize your treasury, spawn agents with spend policies, post
              sealed-bid tasks, and settle payments via x402.
            </p>

            <div className="mt-6 space-y-3">
              {[
                'Create treasury with per-mint balance PDAs',
                'Spawn agents with hierarchical policies',
                'Fund agents and set spend limits',
                'Post sealed-bid tasks to the marketplace',
                'Commit bids and settle auctions on-chain',
                'Pay for API access via x402 protocol',
              ].map((step, idx) => (
                <div
                  key={step}
                  className="flex items-start gap-3 rounded-xl border border-white/6 bg-white/[0.02] p-3"
                >
                  <div className="mt-0.5 grid h-5 w-5 place-items-center rounded-full border border-amber-300/25 text-[10px] text-amber-100">
                    {idx + 1}
                  </div>
                  <p className="text-sm text-zinc-300">{step}</p>
                </div>
              ))}
            </div>
          </GlassPanel>
        </div>
      </div>
    </main>
  );
}
