'use client';

import { PublicKey } from '@solana/web3.js';
import type { SableSdk } from '@sable/sdk';
import { env } from '@/utils/env';
import type { RoutingMode } from '@/contexts/WalletContext';
import type { AgentToolContext } from './types';

export async function buildAgentToolContext(params: {
  sdk: SableSdk | null;
  solanaSdk: SableSdk | null;
  walletPubkey: PublicKey | null;
  walletConnected: boolean;
  routingMode: RoutingMode;
}): Promise<AgentToolContext> {
  const { sdk, solanaSdk, walletPubkey, walletConnected, routingMode } = params;
  const readSdk = solanaSdk || sdk;
  let userStateExists = false;
  const knownMints: AgentToolContext['knownMints'] = [];

  if (readSdk && walletPubkey) {
    try {
      userStateExists = !!(await readSdk.getUserState(walletPubkey));
    } catch {
      userStateExists = false;
    }

    try {
      const balances = await readSdk.getAllUserBalances(walletPubkey);
      const delegation = await readSdk.getDelegationStatus(
        walletPubkey,
        balances.map((b: any) => b.account.mint as PublicKey)
      ).catch(() => []);
      for (const balance of balances) {
        const mint = balance.account.mint as PublicKey;
        const mintBase58 = mint.toBase58();
        const status = delegation.find((d) => d.account.equals(readSdk.pda.deriveUserBalance(walletPubkey, mint)[0]));
        knownMints.push({
          symbol: symbolForMint(mintBase58),
          mint: mintBase58,
          balanceRaw: balance.account.amount?.toString?.() || '0',
          isDelegated: !!status?.isDelegated,
        });
      }
    } catch {
      // Keep demo mode usable when local validator or accounts are unavailable.
    }
  }

  return {
    walletConnected,
    walletPubkey: walletPubkey?.toBase58(),
    userStateExists,
    knownMints,
    selectedMint: knownMints[0]?.mint,
    usdcMint: env.USDC_MINT,
    wsolMint: 'So11111111111111111111111111111111111111112',
    routingMode,
    magicBlockAvailable: Boolean(env.MAGIC_ROUTER_URL && env.PER_HTTP_URL),
    settings: {
      solanaRpcUrl: env.SOLANA_RPC_URL,
      magicRouterUrl: env.MAGIC_ROUTER_URL,
      programId: env.SABLE_PROGRAM_ID,
      paymentsApiConfigured: Boolean(env.PAYMENTS_API_URL),
      perConfigured: Boolean(env.PER_HTTP_URL),
    },
  };
}

function symbolForMint(mint: string) {
  if (mint === env.USDC_MINT) return 'USDC';
  if (mint === 'So11111111111111111111111111111111111111112') return 'wSOL';
  return `${mint.slice(0, 4)}...${mint.slice(-4)}`;
}
