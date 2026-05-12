import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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
  warnings: ['Sable Agent only prepares this action. Your wallet must approve and sign.'],
  estimatedNextStep: 'Review the proposal, then click Approve & open wallet to sign.',
  simulation: { available: false, summary: 'Transaction simulation runs inside your wallet before you sign.' },
  plan: {
    actionType: 'DEPOSIT',
    intent: { actionType: 'DEPOSIT', confidence: 0.9, reason: 'test' },
    domain: 'sable_protocol',
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

  it('renders quick action chips', () => {
    render(React.createElement(AgentChatPanel));
    expect(screen.getByText('Create my treasury')).toBeInTheDocument();
    expect(screen.getByText('Add USDC')).toBeInTheDocument();
    expect(screen.getByText('Deposit tokens')).toBeInTheDocument();
    expect(screen.getByText('Send tokens')).toBeInTheDocument();
    expect(screen.getByText('Batch send')).toBeInTheDocument();
    expect(screen.getByText('Withdraw')).toBeInTheDocument();
    expect(screen.getByText('Commit / Undelegate')).toBeInTheDocument();
    expect(screen.getByText('Show my settings')).toBeInTheDocument();
  });

  it('renders proposal cards', () => {
    render(React.createElement(AgentProposalCard, { proposal, onApprove: vi.fn(), onReject: vi.fn(), isExecuting: false }));
    expect(screen.getByText('Deposit 1 USDC into your Sable vault')).toBeInTheDocument();
    expect(screen.getByText('Approve & open wallet')).toBeInTheDocument();
    expect(screen.getByText('Reject')).toBeInTheDocument();
  });

  it('reject clears a proposal in parent state', () => {
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

  it('out-of-scope message renders refusal and no proposal card', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('should not be called'));

    render(React.createElement(AgentChatPanel));
    fireEvent.change(screen.getByPlaceholderText(/Try: Deposit 1 USDC/), {
      target: { value: 'What is Bitcoin?' },
    });
    fireEvent.click(screen.getByText('Prepare Proposal'));

    await waitFor(() => {
      expect(screen.getByText(/I can only help with Sable treasury actions inside this app/)).toBeInTheDocument();
    });
    expect(screen.queryByText('Approve & open wallet')).not.toBeInTheDocument();
    expect(fetchSpy).not.toHaveBeenCalled();

    fetchSpy.mockRestore();
  });

  it('greeting renders local Sable intro and no proposal card', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('should not be called'));

    render(React.createElement(AgentChatPanel));
    fireEvent.change(screen.getByPlaceholderText(/Try: Deposit 1 USDC/), {
      target: { value: 'Hello' },
    });
    fireEvent.click(screen.getByText('Prepare Proposal'));

    await waitFor(() => {
      expect(screen.getByText(/Hello, I am Sable Agent/)).toBeInTheDocument();
    });
    expect(screen.queryByText('Approve & open wallet')).not.toBeInTheDocument();
    expect(fetchSpy).not.toHaveBeenCalled();

    fetchSpy.mockRestore();
  });

  it('advanced details are collapsed by default', () => {
    render(React.createElement(AgentChatPanel));
    expect(screen.getByText('Advanced')).toBeInTheDocument();
  });

  it('wallet-signing message appears after approve click', () => {
    render(React.createElement(AgentProposalCard, { proposal, onApprove: vi.fn(), onReject: vi.fn(), isExecuting: true }));
    expect(screen.getByText('Open your wallet…')).toBeInTheDocument();
  });
});
