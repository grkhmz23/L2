#!/usr/bin/env tsx
/**
 * Initialize the Sable program on devnet.
 * Runs the `initialize` instruction against the deployed program.
 *
 * Usage:
 *   export SABLE_DEPLOYER_KEYPAIR=/path/to/deployer.json
 *   export SABLE_DEVNET_RPC=https://api.devnet.solana.com
 *   tsx scripts/init-devnet.ts
 */

import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import { AnchorProvider, Program, Wallet } from '@coral-xyz/anchor';
import fs from 'fs';
import path from 'path';

const PROGRAM_ID = new PublicKey('SaSAXcdWhyr1KD8TKRg6K7WPuxcPLZJHKEwsjQgL5Di');

function loadKeypair(path: string): Keypair {
  const secretKey = JSON.parse(fs.readFileSync(path, 'utf-8'));
  return Keypair.fromSecretKey(new Uint8Array(secretKey));
}

async function main() {
  const deployerPath = process.env.SABLE_DEPLOYER_KEYPAIR;
  if (!deployerPath) {
    console.error('ERROR: SABLE_DEPLOYER_KEYPAIR env var is not set');
    process.exit(1);
  }

  const rpcUrl = process.env.SABLE_DEVNET_RPC || 'https://api.devnet.solana.com';
  const deployer = loadKeypair(deployerPath);

  console.log('Deployer:', deployer.publicKey.toBase58());
  console.log('RPC:', rpcUrl);
  console.log('Program ID:', PROGRAM_ID.toBase58());

  const connection = new Connection(rpcUrl, 'confirmed');
  const wallet = new Wallet(deployer);
  const provider = new AnchorProvider(connection, wallet, {
    commitment: 'confirmed',
  });

  // Load IDL
  const idlPath = path.resolve(__dirname, '../packages/sdk/idl/sable.json');
  if (!fs.existsSync(idlPath)) {
    console.error('IDL not found at', idlPath);
    console.error('Run `cargo build-sbf` first to generate the IDL.');
    process.exit(1);
  }
  const idl = JSON.parse(fs.readFileSync(idlPath, 'utf-8'));

  const program = new Program(idl, PROGRAM_ID, provider);

  // Derive Config PDA
  const [configPda] = PublicKey.findProgramAddressSync(
    [Buffer.from('config')],
    PROGRAM_ID
  );

  // Derive Vault Authority PDA
  const [vaultAuthorityPda] = PublicKey.findProgramAddressSync(
    [Buffer.from('vault_authority')],
    PROGRAM_ID
  );

  console.log('Config PDA:', configPda.toBase58());
  console.log('Vault Authority PDA:', vaultAuthorityPda.toBase58());

  // Check if already initialized
  const configAccount = await connection.getAccountInfo(configPda);
  if (configAccount) {
    console.log('Program already initialized (Config PDA exists).');
    return;
  }

  // Initialize
  console.log('Sending initialize transaction...');
  const tx = await program.methods
    .initialize(null) // delegation_program_id = None (uses default)
    .accounts({
      configAdmin: deployer.publicKey,
      config: configPda,
      vaultAuthority: vaultAuthorityPda,
      systemProgram: PublicKey.default,
    })
    .rpc({
      commitment: 'confirmed',
    });

  console.log('Initialize transaction:', tx);
  console.log(
    'Explorer:',
    `https://explorer.solana.com/tx/${tx}?cluster=devnet`
  );
  console.log('Program initialized successfully!');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
