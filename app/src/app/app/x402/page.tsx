'use client';

import { GlassPanel, SectionHeader } from '@/components/ui/luxury';

export default function X402Page() {
  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Payments"
        title="x402 Demo"
        subtitle="Try the x402 protocol: pay-per-request using Sable agent transfers."
      />

      <GlassPanel className="p-6">
        <p className="text-sm text-zinc-300">
          The x402 demo will be available once the facilitator service is running.
        </p>
        <p className="mt-2 text-xs text-zinc-500">
          This page will let you interact with a merchant endpoint that requires x402 payment,
          build payment payloads via the Sable adapter, and settle on-chain.
        </p>
      </GlassPanel>
    </div>
  );
}
