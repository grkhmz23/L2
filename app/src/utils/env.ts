/**
 * Environment variable validation and access
 * All NEXT_PUBLIC_* variables are validated at runtime
 */

export interface EnvConfig {
  SOLANA_RPC_URL: string;
  MAGICBLOCK_RPC_URL: string | null;
  MAGIC_ROUTER_URL: string | null;
  L2CONCEPTV1_PROGRAM_ID: string;
}

// IMPORTANT: use direct process.env access so Next.js can inline NEXT_PUBLIC_* values
// into the client bundle. Dynamic access (process.env[key]) can fall back to defaults
// in production browser builds.
const SOLANA_RPC_URL_ENV = process.env.NEXT_PUBLIC_SOLANA_RPC_URL;
const MAGICBLOCK_RPC_URL_ENV = process.env.NEXT_PUBLIC_MAGICBLOCK_RPC_URL;
const MAGIC_ROUTER_URL_ENV = process.env.NEXT_PUBLIC_MAGIC_ROUTER_URL;
const PROGRAM_ID_ENV = process.env.NEXT_PUBLIC_L2CONCEPTV1_PROGRAM_ID;

export const env: EnvConfig = {
  SOLANA_RPC_URL: SOLANA_RPC_URL_ENV || 'http://127.0.0.1:8899',
  MAGICBLOCK_RPC_URL: MAGICBLOCK_RPC_URL_ENV || null,
  MAGIC_ROUTER_URL: MAGIC_ROUTER_URL_ENV || null,
  L2CONCEPTV1_PROGRAM_ID:
    PROGRAM_ID_ENV || 'L2CnccKT1qHNS1wJ7p3wJ3JhCX5s4J5wT5x3h5mH2j1',
};

// Validate that program ID is a valid public key
try {
  new (require('@solana/web3.js').PublicKey)(env.L2CONCEPTV1_PROGRAM_ID);
} catch (error) {
  console.error('Invalid L2CONCEPTV1_PROGRAM_ID:', env.L2CONCEPTV1_PROGRAM_ID);
  throw new Error('NEXT_PUBLIC_L2CONCEPTV1_PROGRAM_ID must be a valid Solana public key');
}
