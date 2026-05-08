import fs from 'fs';
import os from 'os';
import path from 'path';
import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import {
  createMint,
  getOrCreateAssociatedTokenAccount,
  mintTo,
} from '@solana/spl-token';

function readKeypair(filePath: string): Keypair {
  const expanded = filePath.startsWith('~')
    ? path.join(os.homedir(), filePath.slice(1))
    : filePath;
  const secret = JSON.parse(fs.readFileSync(expanded, 'utf8'));
  return Keypair.fromSecretKey(Uint8Array.from(secret));
}

function arg(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv.find((item) => item.startsWith(prefix))?.slice(prefix.length);
}

async function main() {
  const rpcUrl =
    arg('rpc') ||
    process.env.SOLANA_RPC_URL ||
    process.env.NEXT_PUBLIC_SOLANA_RPC_URL ||
    'http://127.0.0.1:8899';
  const keypairPath =
    arg('keypair') ||
    process.env.SOLANA_KEYPAIR ||
    path.join(os.homedir(), '.config/solana/id.json');
  const decimals = Number(arg('decimals') || '6');
  const uiAmount = arg('amount') || '1000';
  const owner = new PublicKey(arg('owner') || readKeypair(keypairPath).publicKey.toBase58());

  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 9) {
    throw new Error('--decimals must be an integer between 0 and 9');
  }
  if (!/^\d+(\.\d+)?$/.test(uiAmount)) {
    throw new Error('--amount must be a positive decimal number');
  }

  const [whole, fractional = ''] = uiAmount.split('.');
  if (fractional.length > decimals) {
    throw new Error(`--amount supports at most ${decimals} decimal place(s)`);
  }
  const rawAmount = BigInt(`${whole}${fractional.padEnd(decimals, '0')}`);
  if (rawAmount <= 0n) {
    throw new Error('--amount must be greater than zero');
  }

  const payer = readKeypair(keypairPath);
  const connection = new Connection(rpcUrl, 'confirmed');

  const mint = await createMint(connection, payer, payer.publicKey, null, decimals);
  const ata = await getOrCreateAssociatedTokenAccount(connection, payer, mint, owner);
  const signature = await mintTo(connection, payer, mint, ata.address, payer, rawAmount);

  console.log('Created test SPL mint');
  console.log(`RPC: ${rpcUrl}`);
  console.log(`Mint: ${mint.toBase58()}`);
  console.log(`Decimals: ${decimals}`);
  console.log(`Owner: ${owner.toBase58()}`);
  console.log(`Owner ATA: ${ata.address.toBase58()}`);
  console.log(`Minted UI amount: ${uiAmount}`);
  console.log(`Mint tx: ${signature}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
