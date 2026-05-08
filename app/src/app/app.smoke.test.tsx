import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('@solana/wallet-adapter-react', () => ({
  useWallet: () => ({ connected: false, publicKey: null }),
}));

vi.mock('next/navigation', () => ({
  usePathname: () => '/app',
}));

vi.mock('@/contexts/WalletContext', () => ({
  WalletMultiButton: (props: React.ButtonHTMLAttributes<HTMLButtonElement>) =>
    React.createElement('button', { type: 'button', ...props }, 'Connect Wallet'),
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

import LandingPage from './page';
import { ActionPanel } from '@/components/ActionPanel';
import { Sidebar } from '@/components/Sidebar';
import { CompleteSetupModal } from '@/components/CompleteSetupModal';

describe('frontend smoke', () => {
  it('renders the landing page wallet entry', () => {
    render(React.createElement(LandingPage));
    expect(screen.getAllByText('Sable').length).toBeGreaterThan(0);
    expect(screen.getByText('Connect Wallet')).toBeInTheDocument();
  });

  it('renders main action forms without blockchain state', () => {
    render(React.createElement(ActionPanel));
    expect(screen.getByText('Treasury')).toBeInTheDocument();
    expect(screen.getByText('Execute Transfer')).toBeInTheDocument();
    expect(screen.getByText('Deposit')).toBeInTheDocument();
    expect(screen.getByText('Withdraw')).toBeInTheDocument();
    expect(screen.getByText('Send / Batch Send').closest('button')).toBeDisabled();
  });

  it('renders the sidebar shell navigation', () => {
    render(React.createElement(Sidebar));
    expect(screen.getByText('Agent Treasury')).toBeInTheDocument();
    expect(screen.getByText('Treasury')).toBeInTheDocument();
    expect(screen.getByText('Agents')).toBeInTheDocument();
    expect(screen.getByText('Settings')).toBeInTheDocument();
  });

  it('renders setup modal with copyable truncated mint text', () => {
    const wsol = 'So11111111111111111111111111111111111111112';

    render(
      React.createElement(CompleteSetupModal, {
        isOpen: true,
        onClose: vi.fn(),
        onComplete: vi.fn(),
      })
    );

    expect(screen.getByText('Add Treasury Assets')).toBeInTheDocument();
    expect(screen.getByText('Add wSOL Balance')).toBeInTheDocument();
    expect(screen.queryByText(wsol)).not.toBeInTheDocument();
    expect(screen.getByText('So11111111...11111112')).toBeInTheDocument();
  });
});
