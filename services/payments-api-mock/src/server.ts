/**
 * Mock Private Payments API Server
 *
 * Mirrors the MagicBlock Private Payments API endpoint shape for local development.
 *
 * Endpoints:
 *   POST /deposit          → { kind: "deposit", transactionBase64, ... }
 *   POST /transfer         → { kind: "transfer", transactionBase64, ... }
 *   POST /withdraw         → { kind: "withdraw", transactionBase64, ... }
 *   GET  /balance          → { balance: string }
 *   GET  /mint-init-status → { initialized: boolean }
 *   POST /init-mint        → { kind: "initMint", transactionBase64, ... }
 *   POST /aml-screen       → { ok: boolean, reason?: string }
 *
 * Modeled after:
 *   https://docs.magicblock.gg/pages/private-ephemeral-rollups-pers/api-reference/per/introduction
 *   https://github.com/magicblock-labs/private-payments-demo
 */

import http from 'http';
import {
  Connection,
  PublicKey,
  Transaction,
  SystemProgram,
  Keypair,
} from '@solana/web3.js';
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountInstruction,
  createTransferCheckedInstruction,
  createInitializeMintInstruction,
  MINT_SIZE,
  getMinimumBalanceForRentExemptMint,
} from '@solana/spl-token';

const PORT = process.env.PAYMENTS_MOCK_PORT ? parseInt(process.env.PAYMENTS_MOCK_PORT, 10) : 4444;
const SOLANA_RPC = process.env.SOLANA_RPC_URL || 'http://localhost:8899';

const connection = new Connection(SOLANA_RPC, 'confirmed');

// Hardcoded OFAC-style test list for deterministic rejection testing
const OFAC_TEST_LIST = new Set([
  'OFAC_TEST_ADDRESS_12345',
  '7nY7H7H7H7H7H7H7H7H7H7H7H7H7H7H7H7H7H7H7H7H', // 43-char base58-like
]);

// In-memory balance store for mock balances
const mockBalances = new Map<string, string>(); // key = "owner:mint" → balance string
const mockMintInitStatus = new Map<string, boolean>(); // key = mint → initialized

function parseQuery(url: string): Record<string, string> {
  const query: Record<string, string> = {};
  const idx = url.indexOf('?');
  if (idx === -1) return query;
  const params = new URLSearchParams(url.slice(idx + 1));
  params.forEach((v, k) => {
    query[k] = v;
  });
  return query;
}

async function readBody(req: http.IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => (data += chunk));
    req.on('end', () => {
      try {
        resolve(JSON.parse(data));
      } catch {
        resolve({});
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res: http.ServerResponse, status: number, payload: any) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(payload));
}

async function getLatestBlockhash(): Promise<{ blockhash: string; lastValidBlockHeight: number }> {
  try {
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
    return { blockhash, lastValidBlockHeight };
  } catch {
    // Fallback for environments without a live RPC (e.g., CI or mock-only runs)
    return {
      blockhash: '11111111111111111111111111111111',
      lastValidBlockHeight: 999999999,
    };
  }
}

function txToPayload(
  tx: Transaction,
  kind: 'deposit' | 'transfer' | 'withdraw' | 'initMint'
): {
  kind: string;
  version: string;
  transactionBase64: string;
  sendTo: string;
  recentBlockhash: string;
  lastValidBlockHeight: number;
  instructionCount: number;
  requiredSigners: string[];
} {
  return {
    kind,
    version: 'legacy',
    transactionBase64: tx.serialize({ requireAllSignatures: false }).toString('base64'),
    sendTo: 'base',
    recentBlockhash: tx.recentBlockhash!,
    lastValidBlockHeight: 0, // mock doesn't track this precisely
    instructionCount: tx.instructions.length,
    requiredSigners: tx.signatures.map((s) => s.publicKey.toBase58()),
  };
}

async function buildDepositTx(
  from: PublicKey,
  to: PublicKey,
  amount: bigint,
  mint: PublicKey
): Promise<Transaction> {
  const { blockhash } = await getLatestBlockhash();
  const tx = new Transaction();
  tx.recentBlockhash = blockhash;
  tx.feePayer = from;

  const fromAta = getAssociatedTokenAddressSync(mint, from, true);
  const toAta = getAssociatedTokenAddressSync(mint, to, true);

  // Ensure receiver ATA exists (mock — in real life this would be more robust)
  tx.add(
    createAssociatedTokenAccountInstruction(
      from,
      toAta,
      to,
      mint,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    )
  );

  tx.add(
    createTransferCheckedInstruction(
      fromAta,
      mint,
      toAta,
      from,
      amount,
      6, // USDC decimals mock
      [],
      TOKEN_PROGRAM_ID
    )
  );

  return tx;
}

async function buildTransferTx(
  from: PublicKey,
  to: PublicKey,
  amount: bigint,
  mint: PublicKey
): Promise<Transaction> {
  const { blockhash } = await getLatestBlockhash();
  const tx = new Transaction();
  tx.recentBlockhash = blockhash;
  tx.feePayer = from;

  const fromAta = getAssociatedTokenAddressSync(mint, from, true);
  const toAta = getAssociatedTokenAddressSync(mint, to, true);

  tx.add(
    createTransferCheckedInstruction(
      fromAta,
      mint,
      toAta,
      from,
      amount,
      6,
      [],
      TOKEN_PROGRAM_ID
    )
  );

  return tx;
}

async function buildWithdrawTx(
  from: PublicKey,
  to: PublicKey,
  amount: bigint,
  mint: PublicKey
): Promise<Transaction> {
  // Structurally identical to transfer for the mock
  return buildTransferTx(from, to, amount, mint);
}

async function buildInitMintTx(
  payer: PublicKey,
  mint: PublicKey
): Promise<Transaction> {
  const { blockhash } = await getLatestBlockhash();
  const tx = new Transaction();
  tx.recentBlockhash = blockhash;
  tx.feePayer = payer;

  let lamports: number;
  try {
    lamports = await getMinimumBalanceForRentExemptMint(connection);
  } catch {
    lamports = 1461600; // fallback rent-exempt mint balance
  }

  tx.add(
    SystemProgram.createAccount({
      fromPubkey: payer,
      newAccountPubkey: mint,
      space: MINT_SIZE,
      lamports,
      programId: TOKEN_PROGRAM_ID,
    })
  );

  tx.add(
    createInitializeMintInstruction(
      mint,
      6, // USDC-like decimals
      payer,
      null,
      TOKEN_PROGRAM_ID
    )
  );

  return tx;
}

const server = http.createServer(async (req, res) => {
  const url = req.url || '/';
  const method = req.method || 'GET';

  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-API-Key');

  if (method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // Health check
  if (url === '/health' && method === 'GET') {
    sendJson(res, 200, { status: 'ok' });
    return;
  }

  // POST /deposit
  if (url === '/deposit' && method === 'POST') {
    const body = await readBody(req);
    const { from, amount, mint } = body;

    if (!from || !amount) {
      sendJson(res, 400, { error: 'Missing from or amount' });
      return;
    }

    try {
      const fromPk = new PublicKey(from);
      const mintPk = mint ? new PublicKey(mint) : Keypair.generate().publicKey;
      const toPk = fromPk; // Deposit to self in this mock
      const tx = await buildDepositTx(fromPk, toPk, BigInt(amount), mintPk);
      sendJson(res, 200, txToPayload(tx, 'deposit'));
    } catch (e: any) {
      sendJson(res, 500, { error: e.message });
    }
    return;
  }

  // POST /transfer
  if (url === '/transfer' && method === 'POST') {
    const body = await readBody(req);
    const { from, to, amount, mint } = body;

    if (!from || !to || !amount) {
      sendJson(res, 400, { error: 'Missing from, to, or amount' });
      return;
    }

    try {
      const fromPk = new PublicKey(from);
      const toPk = new PublicKey(to);
      const mintPk = mint ? new PublicKey(mint) : Keypair.generate().publicKey;
      const tx = await buildTransferTx(fromPk, toPk, BigInt(amount), mintPk);
      sendJson(res, 200, txToPayload(tx, 'transfer'));
    } catch (e: any) {
      sendJson(res, 500, { error: e.message });
    }
    return;
  }

  // POST /withdraw
  if (url === '/withdraw' && method === 'POST') {
    const body = await readBody(req);
    const { from, to, amount, mint } = body;

    if (!from || !to || !amount) {
      sendJson(res, 400, { error: 'Missing from, to, or amount' });
      return;
    }

    try {
      const fromPk = new PublicKey(from);
      const toPk = new PublicKey(to);
      const mintPk = mint ? new PublicKey(mint) : Keypair.generate().publicKey;
      const tx = await buildWithdrawTx(fromPk, toPk, BigInt(amount), mintPk);
      sendJson(res, 200, txToPayload(tx, 'withdraw'));
    } catch (e: any) {
      sendJson(res, 500, { error: e.message });
    }
    return;
  }

  // GET /balance?owner=&mint=
  if (url.startsWith('/balance') && method === 'GET') {
    const query = parseQuery(url);
    const { owner, mint } = query;

    if (!owner) {
      sendJson(res, 400, { error: 'Missing owner' });
      return;
    }

    try {
      new PublicKey(owner);
      if (mint) new PublicKey(mint);
    } catch {
      sendJson(res, 400, { error: 'Invalid pubkey' });
      return;
    }

    const key = mint ? `${owner}:${mint}` : `${owner}:native`;
    const balance = mockBalances.get(key) || '0';
    sendJson(res, 200, { balance, owner, mint: mint || null });
    return;
  }

  // GET /mint-init-status?mint=
  if (url.startsWith('/mint-init-status') && method === 'GET') {
    const query = parseQuery(url);
    const { mint } = query;

    if (!mint) {
      sendJson(res, 400, { error: 'Missing mint' });
      return;
    }

    try {
      new PublicKey(mint);
    } catch {
      sendJson(res, 400, { error: 'Invalid mint' });
      return;
    }

    const initialized = mockMintInitStatus.get(mint) || false;
    sendJson(res, 200, { mint, initialized });
    return;
  }

  // POST /init-mint
  if (url === '/init-mint' && method === 'POST') {
    const body = await readBody(req);
    const { mint, payer } = body;

    if (!mint) {
      sendJson(res, 400, { error: 'Missing mint' });
      return;
    }

    try {
      const mintPk = new PublicKey(mint);
      const payerPk = payer ? new PublicKey(payer) : mintPk;
      const tx = await buildInitMintTx(payerPk, mintPk);
      mockMintInitStatus.set(mint, true);
      sendJson(res, 200, txToPayload(tx, 'initMint'));
    } catch (e: any) {
      sendJson(res, 500, { error: e.message });
    }
    return;
  }

  // POST /aml-screen
  if (url === '/aml-screen' && method === 'POST') {
    const body = await readBody(req);
    const { address } = body;

    if (!address) {
      sendJson(res, 400, { error: 'Missing address' });
      return;
    }

    if (OFAC_TEST_LIST.has(address)) {
      sendJson(res, 200, {
        ok: false,
        reason: 'Address matches OFAC sanctioned list',
      });
      return;
    }

    sendJson(res, 200, { ok: true });
    return;
  }

  sendJson(res, 404, { error: 'Not found' });
});

server.listen(PORT, () => {
  console.log(`Payments API Mock listening on http://localhost:${PORT}`);
  console.log(`Connected to Solana RPC: ${SOLANA_RPC}`);
});
