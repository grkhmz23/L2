import { describe, expect, it, vi } from 'vitest';
import { deterministicPlan } from './planner';
import { buildAgentProposal } from './guards';
import { buildOutOfScopePlan, classifySableScope } from './scope';
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

  it('understands non-technical phrases for treasury creation', () => {
    expect(deterministicPlan('I want to start', context).actionType).toBe('CREATE_TREASURY');
    expect(deterministicPlan('get started', context).actionType).toBe('CREATE_TREASURY');
    expect(deterministicPlan('create account', context).actionType).toBe('CREATE_TREASURY');
    expect(deterministicPlan('make treasury', context).actionType).toBe('CREATE_TREASURY');
  });

  it('understands non-technical phrases for adding assets', () => {
    expect(deterministicPlan('add usdc', context).actionType).toBe('ADD_MINT');
    expect(deterministicPlan('enable usdc', context).actionType).toBe('ADD_MINT');
    expect(deterministicPlan('use usdc', context).actionType).toBe('ADD_MINT');
  });

  it('understands non-technical phrases for deposits', () => {
    expect(deterministicPlan('put 1 usdc in', context).actionType).toBe('DEPOSIT');
    // Missing amount or mint asks follow-up instead of failing
    expect(deterministicPlan('fund my treasury', context).actionType).toBe('CLARIFY_SABLE_ACTION');
    expect(deterministicPlan('top up', context).actionType).toBe('CLARIFY_SABLE_ACTION');
  });

  it('understands non-technical phrases for sends', () => {
    expect(deterministicPlan(`pay 0.5 usdc to ${recipient}`, context).actionType).toBe('INTERNAL_TRANSFER');
    expect(deterministicPlan(`transfer 1 usdc to ${recipient}`, context).actionType).toBe('INTERNAL_TRANSFER');
    // Missing recipient asks follow-up
    expect(deterministicPlan('pay 0.5 usdc', context).actionType).toBe('CLARIFY_SABLE_ACTION');
    expect(deterministicPlan('transfer 1 usdc', context).actionType).toBe('CLARIFY_SABLE_ACTION');
  });

  it('understands non-technical phrases for batch sends', () => {
    expect(deterministicPlan(`batch send 1 usdc to these addresses: ${recipient}`, context).actionType).toBe('BATCH_TRANSFER');
    // Missing recipients asks follow-up
    expect(deterministicPlan('send to many addresses', context).actionType).toBe('CLARIFY_SABLE_ACTION');
    expect(deterministicPlan('airdrop 0.1 usdc', context).actionType).toBe('CLARIFY_SABLE_ACTION');
    expect(deterministicPlan('pay list', context).actionType).toBe('CLARIFY_SABLE_ACTION');
  });

  it('understands non-technical phrases for withdrawals', () => {
    expect(deterministicPlan('take 1 usdc back to my wallet', context).actionType).toBe('WITHDRAW');
    // Missing amount asks follow-up
    expect(deterministicPlan('cash out', context).actionType).toBe('CLARIFY_SABLE_ACTION');
    expect(deterministicPlan('move back to wallet', context).actionType).toBe('CLARIFY_SABLE_ACTION');
  });

  it('understands non-technical phrases for delegation', () => {
    expect(deterministicPlan('make it fast', context).actionType).toBe('DELEGATE');
    expect(deterministicPlan('use magicblock', context).actionType).toBe('DELEGATE');
  });

  it('understands non-technical phrases for commit/undelegate', () => {
    expect(deterministicPlan('save state', context).actionType).toBe('COMMIT_UNDELEGATE');
    expect(deterministicPlan('exit fast mode', context).actionType).toBe('COMMIT_UNDELEGATE');
  });

  it('understands non-technical phrases for balances', () => {
    expect(deterministicPlan('what do I have', context).actionType).toBe('EXPLAIN_BALANCES');
    expect(deterministicPlan('show balance', context).actionType).toBe('EXPLAIN_BALANCES');
    expect(deterministicPlan('explain balance', context).actionType).toBe('EXPLAIN_BALANCES');
  });

  it('asks follow-up when amount is missing for deposit', () => {
    const plan = deterministicPlan('deposit', context);
    expect(plan.actionType).toBe('CLARIFY_SABLE_ACTION');
    expect(plan.summary).toContain('How much');
  });

  it('asks follow-up when recipient is missing for send', () => {
    const plan = deterministicPlan('send USDC', context);
    expect(plan.actionType).toBe('CLARIFY_SABLE_ACTION');
    expect(plan.summary).toContain('wallet address');
  });

  it('asks follow-up when amount is missing for withdraw', () => {
    const plan = deterministicPlan('withdraw', context);
    expect(plan.actionType).toBe('CLARIFY_SABLE_ACTION');
    expect(plan.summary).toContain('How much');
  });

  it('classifies out-of-scope and ambiguous requests before planning', () => {
    expect(classifySableScope('What is Bitcoin?', context).domain).toBe('out_of_scope');
    expect(classifySableScope('Tell me a joke', context).domain).toBe('out_of_scope');
    expect(classifySableScope('What token should I buy?', context).domain).toBe('out_of_scope');
    expect(classifySableScope('help me', context).domain).toBe('ambiguous');
    expect(classifySableScope('Deposit 1 USDC', context).domain).toBe('sable_protocol');
    expect(classifySableScope(`Send 0.1 USDC to ${recipient}`, context).domain).toBe('sable_protocol');
  });

  it('blocks invalid amount and address proposals', () => {
    const plan = deterministicPlan('send 0 usdc to not-a-pubkey', context);
    const proposal = buildAgentProposal(
      { ...plan, amount: '0', recipient: 'not-a-pubkey', recipients: [{ address: 'not-a-pubkey', amount: '0' }] },
      context
    );
    expect(proposal.blocked).toBe(true);
    expect(proposal.prerequisites.join(' ')).toContain('positive');
    expect(proposal.prerequisites.join(' ')).toContain('look right');
  });

  it('returns prerequisite responses for missing wallet and treasury', () => {
    const plan = deterministicPlan('deposit 1 usdc', context);
    const proposal = buildAgentProposal(plan, {
      ...context,
      walletConnected: false,
      userStateExists: false,
    });
    expect(proposal.blocked).toBe(true);
    expect(proposal.prerequisites.join(' ')).toContain('connect your wallet');
    expect(proposal.prerequisites.join(' ')).toContain('Sable treasury');
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

  it('tool registry rejects out-of-scope and unknown plans', async () => {
    const outOfScopeProposal = buildAgentProposal(buildOutOfScopePlan('What is Bitcoin?'), context);
    await expect(
      executeAgentPlan({
        proposal: outOfScopeProposal,
        context,
        sdk: {} as any,
        solanaSdk: null,
        solanaConnection: {} as any,
        userApproved: true,
      })
    ).rejects.toThrow('only Sable protocol');

    const unknownProposal = buildAgentProposal(deterministicPlan('sable something unknown', context), context);
    await expect(
      executeAgentPlan({
        proposal: unknownProposal,
        context,
        sdk: {} as any,
        solanaSdk: null,
        solanaConnection: {} as any,
        userApproved: true,
      })
    ).rejects.toThrow('cannot execute');
  });

  it('rejects unknown actions even with userApproved', async () => {
    const unknownPlan = deterministicPlan('something unknown', context);
    const proposal = buildAgentProposal(unknownPlan, context);
    await expect(
      executeAgentPlan({
        proposal,
        context,
        sdk: {} as any,
        solanaSdk: null,
        solanaConnection: {} as any,
        userApproved: true,
      })
    ).rejects.toThrow('cannot execute');
  });
});
