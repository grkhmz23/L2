'use client';

import { AgentsView } from '@/components/AgentsView';
import { AgentChatPanel } from '@/components/AgentChatPanel';

export default function AgentsPage() {
  return (
    <div className="space-y-6">
      <AgentChatPanel />
      <AgentsView />
    </div>
  );
}
