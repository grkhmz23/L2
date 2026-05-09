import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { AgentChatPanel, AgentProposalCard } from './AgentChatPanel';
import type { AgentProposal } from '@/agent/types';

vi.mock('@solana/wallet-adapter-react', () => ({
  useWallet: () => ({ connected: false, publicKey: null }),
}));

vi.mock('@/contexts/WalletContext', () => ({
  useWalletContext: () => ({
    sdk: null,
    solanaSdk: null,
    connection: {},
    solanaConnection: {},
    routingMode: 'solana',
    setRoutingMode: vi.fn(),
    isLoading: false,
    refreshUserState: vi.fn(),
    refreshNonce: 0,
  }),
}));

const proposal: AgentProposal = {
  id: 'proposal',
  summary: 'Deposit 1 USDC to the vault',
  route: 'Direct Anchor',
  riskLevel: 'MEDIUM',
  blocked: false,
  accountsTouched: ['Wallet: 11111111111111111111111111111111'],
  prerequisites: [],
  warnings: ['Wallet approval required.'],
  estimatedNextStep: 'Approve and sign.',
  simulation: { available: false, summary: 'Simulation unavailable for this action.' },
  plan: {
    actionType: 'DEPOSIT',
    intent: { actionType: 'DEPOSIT', confidence: 0.9, reason: 'test' },
    summary: 'Deposit 1 USDC to the vault',
    amount: '1',
    mint: '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU',
    mintSymbol: 'USDC',
    route: 'Direct Anchor',
    requiresTransaction: true,
    rawText: 'deposit 1 usdc',
    missingFields: [],
    warnings: [],
  },
};

describe('agent chat UI', () => {
  it('renders the Agent Chat surface', () => {
    render(React.createElement(AgentChatPanel));
    expect(screen.getByText('Treasury Actions By Proposal')).toBeInTheDocument();
    expect(screen.getByText('Prepare Proposal')).toBeInTheDocument();
  });

  it('renders proposal cards', () => {
    render(React.createElement(AgentProposalCard, { proposal, onApprove: vi.fn(), onReject: vi.fn(), isExecuting: false }));
    expect(screen.getByText('Deposit 1 USDC to the vault')).toBeInTheDocument();
    expect(screen.getByText('Approve & Sign')).toBeInTheDocument();
    expect(screen.getByText('Reject')).toBeInTheDocument();
  });

  it('Reject clears a proposal in parent state', () => {
    function Harness() {
      const [current, setCurrent] = React.useState<AgentProposal | null>(proposal);
      return current ? (
        <AgentProposalCard proposal={current} onApprove={vi.fn()} onReject={() => setCurrent(null)} isExecuting={false} />
      ) : (
        <p>No proposal</p>
      );
    }

    render(React.createElement(Harness));
    fireEvent.click(screen.getByText('Reject'));
    expect(screen.getByText('No proposal')).toBeInTheDocument();
  });
});
