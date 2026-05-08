import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('@solana/wallet-adapter-react', () => ({
  useWallet: () => ({ connected: false, publicKey: null }),
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
  });
});
