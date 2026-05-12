'use client';

import { AgentChatPanel } from '@/components/AgentChatPanel';

export default function DemoPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-8 p-6">
      <div className="rounded-lg border border-amber-200/20 bg-amber-200/8 p-4 text-sm text-amber-100">
        <strong>Demo Mode:</strong> This is the Sable Agent Chat demo page. Use this for hackathon video recording.
        Connect your wallet, then walk through: Create Treasury → Add USDC → Deposit → Send → Batch Send → Delegate → Withdraw.
      </div>
      <AgentChatPanel />
    </div>
  );
}
