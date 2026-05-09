import { describe, expect, it, vi } from 'vitest';
import { deterministicPlan } from './planner';
import { buildAgentProposal } from './guards';
import { executeAgentPlan } from './tools';
import type { AgentToolContext } from './types';

const recipient = '11111111111111111111111111111111';

const context: AgentToolContext = {
  walletConnected: true,
  walletPubkey: 'So11111111111111111111111111111111111111112',
  userStateExists: true,
  knownMints: [{ symbol: 'USDC', mint: '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU', balanceRaw: '1000000' }],
  selectedMint: '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU',
  usdcMint: '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU',
  wsolMint: 'So11111111111111111111111111111111111111112',
  routingMode: 'solana',
  magicBlockAvailable: true,
  settings: {
    solanaRpcUrl: 'http://127.0.0.1:8899',
    magicRouterUrl: 'https://devnet-router.magicblock.app',
    programId: 'SaSAXcdWhyr1KD8TKRg6K7WPuxcPLZJHKEwsjQgL5Di',
    paymentsApiConfigured: false,
    perConfigured: true,
  },
};

describe('agent planner and guards', () => {
  it('parses deposit, send, batch, withdraw, delegate, and commit commands', () => {
    expect(deterministicPlan('deposit 10 usdc', context).actionType).toBe('DEPOSIT');
    expect(deterministicPlan(`send 2 usdc to ${recipient}`, context).actionType).toBe('INTERNAL_TRANSFER');
    expect(deterministicPlan(`batch send 1 usdc to these addresses: ${recipient}`, context).actionType).toBe('BATCH_TRANSFER');
    expect(deterministicPlan('withdraw 5 usdc', context).actionType).toBe('WITHDRAW');
    expect(deterministicPlan('delegate to magicblock', context).actionType).toBe('DELEGATE');
    expect(deterministicPlan('commit and undelegate', context).actionType).toBe('COMMIT_UNDELEGATE');
  });

  it('blocks invalid amount and address proposals', () => {
    const plan = deterministicPlan('send 0 usdc to not-a-pubkey', context);
    const proposal = buildAgentProposal(
      { ...plan, amount: '0', recipient: 'not-a-pubkey', recipients: [{ address: 'not-a-pubkey', amount: '0' }] },
      context
    );
    expect(proposal.blocked).toBe(true);
    expect(proposal.prerequisites.join(' ')).toContain('positive amount');
    expect(proposal.prerequisites.join(' ')).toContain('Invalid recipient');
  });

  it('returns prerequisite responses for missing wallet and treasury', () => {
    const plan = deterministicPlan('deposit 1 usdc', context);
    const proposal = buildAgentProposal(plan, {
      ...context,
      walletConnected: false,
      userStateExists: false,
    });
    expect(proposal.blocked).toBe(true);
    expect(proposal.prerequisites.join(' ')).toContain('Connect a wallet');
    expect(proposal.prerequisites.join(' ')).toContain('Create your Sable treasury');
  });

  it('execution cannot run without explicit user approval', async () => {
    const plan = deterministicPlan('explain my balances', context);
    const proposal = buildAgentProposal(plan, context);
    await expect(
      executeAgentPlan({
        proposal,
        context,
        sdk: null,
        solanaSdk: null,
        solanaConnection: {} as any,
        userApproved: false,
      })
    ).rejects.toThrow('userApproved=true');
  });
});
