import { BN } from '@coral-xyz/anchor';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { ensureSdk, getPda, PROGRAM_ID, sleep } from './setup';

async function withRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
  let lastError: any;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      lastError = err;
      const message = err?.message || '';
      const is429 = message.includes('429') || message.includes('Too Many Requests') || err?.code === 429 || err?.status === 429;
      if (!is429 || attempt === maxRetries) throw err;
      const delay = Math.min(2000 * 2 ** attempt, 8000);
      await sleep(delay);
    }
  }
  throw lastError;
}

export async function checkConservation(): Promise<void> {
  const sdk = await ensureSdk();
  const connection = sdk.config.connection;

  // Fetch all UserBalance accounts
  const userBalances = await withRetry(() => sdk.program.account.userBalance.all());
  const agentBalances = await withRetry(() => sdk.program.account.agentBalance.all());
  const taskEscrows = await withRetry(() => sdk.program.account.taskEscrow.all());

  let ledgerTotal = new BN(0);

  for (const acc of userBalances) {
    ledgerTotal = ledgerTotal.add(acc.account.amount);
  }

  for (const acc of agentBalances) {
    ledgerTotal = ledgerTotal.add(acc.account.amount);
  }

  for (const acc of taskEscrows) {
    ledgerTotal = ledgerTotal.add(acc.account.amount);
  }

  // Fetch vault ATAs
  const vaultAuthority = getPda().deriveVaultAuthority()[0];
  const tokenAccounts = await withRetry(() =>
    connection.getParsedTokenAccountsByOwner(vaultAuthority, {
      programId: TOKEN_PROGRAM_ID,
    })
  );

  let vaultTotal = new BN(0);
  for (const ta of tokenAccounts.value) {
    const amount = ta.account.data.parsed.info.tokenAmount.amount;
    vaultTotal = vaultTotal.add(new BN(amount));
  }

  if (!ledgerTotal.eq(vaultTotal)) {
    throw new Error(
      `Conservation check failed: ledger=${ledgerTotal.toString()} vault=${vaultTotal.toString()}`
    );
  }
}
