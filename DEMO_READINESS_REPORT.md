# Demo Readiness Report

Date: 2026-05-08

## Summary

The repo is branded and packaged as **Sable**, not L2conceptv1. The on-chain program, SDK, app copy, docs, and package names all use Sable. If L2conceptv1 was meant to remain the product name, this is inconsistent; if Sable is the intended hackathon/product rename, the repo is internally consistent after this pass.

The frontend is wired to the Anchor backend for the core wallet-like flow: join/setup, add mint, deposit, internal batch transfer, delegate, commit/undelegate, external vault send, and withdraw. Private Payments API and PER private reads are not automatically usable without external endpoints/credentials; copy was adjusted to avoid presenting those as guaranteed production features.

## Program ID Audit

All checked defaults point to:

`SaSAXcdWhyr1KD8TKRg6K7WPuxcPLZJHKEwsjQgL5Di`

- `programs/sable/Anchor.toml`: localnet and devnet use this ID.
- `programs/sable/src/lib.rs`: `declare_id!` uses this ID.
- `packages/sdk/idl/sable.json`: `address` uses this ID.
- `app/src/idl/sable.json`: `address` uses this ID.
- `packages/common/src/constants.ts`: `PROGRAM_ID_DEVNET` uses this ID.
- `app/src/utils/env.ts`: `NEXT_PUBLIC_SABLE_PROGRAM_ID` can override, otherwise defaults to this ID.

Fix made: SDK now overrides the Anchor `Program` ID with `config.programId`, not just PDA derivation. Before this, env-driven program IDs could derive PDAs for one program while sending instructions to the IDL default address.

## Commands Run

| Command | Result | Notes |
|---|---:|---|
| `pnpm install` | Pass | Installed pnpm first because it was missing. Optional native binding fell back to JS under Node 26. |
| `pnpm anchor:build` | Pass | Script now forces SBF platform-tools `v1.48`; default Solana 2.2.0 tools used Rust 1.79 and failed dependency MSRV checks. |
| `pnpm idl:sync` | Pass | Syncs checked-in SDK IDL to app when generated Anchor IDL is absent. Warns clearly. |
| `pnpm anchor:test` | Pass | 98 passing. Required local keypair creation and `ts-mocha` dependency. |
| `pnpm app:typecheck` | Pass | Workspace package `dist` builds are required before app type resolution. |
| `pnpm app:lint` | Pass | Added explicit Next ESLint config; no warnings/errors. |
| `pnpm app:build` | Pass | Builds production app. Static generation still prints bigint/localStorage environment warnings. |
| `pnpm app:smoke` | Pass | New UI-only smoke tests: 3 files, 5 tests. |
| `pnpm build:all` | Pass | Builds common, SDK, x402 client, services, and app. |

## Fixes Made

- Hardened Anchor build/test setup:
  - Enabled Rust release overflow checks in `programs/sable/Cargo.toml`.
  - Updated `anchor:build` to use SBF platform-tools `v1.48`.
  - Fixed `programs/sable/Anchor.toml` test script paths for pnpm workspace execution.
  - Added missing `ts-mocha`.
- Fixed SDK/frontend wiring:
  - SDK Anchor `Program` address now follows `config.programId`.
  - Frontend passes `paymentsApiUrl` from `NEXT_PUBLIC_SABLE_PAYMENTS_API`.
  - SDK accepts both old and current payments env names.
  - Payments API default is now empty, so MagicBlock payments are not silently assumed.
  - Deposit/send/withdraw UI parses token amounts using the mint's actual decimals instead of assuming 9 decimals.
  - Success toasts include transaction signatures for deposit/withdraw.
- Improved app build reliability:
  - Replaced broad `@solana/wallet-adapter-wallets` import with direct Phantom/Solflare adapters.
  - Added explicit `app/.eslintrc.json`.
  - Fixed lint hook warnings and unescaped text.
- Added demo support:
  - Added `pnpm dev:create-test-mint` helper for creating/minting a local/devnet SPL test token.
  - Added UI-only smoke tests for app render, action forms, env defaults, and amount parsing.
- Reduced misleading claims:
  - Adjusted README, hackathon notes, demo script, landing page, package description, and Fund modal copy to distinguish implemented ER/PER hooks from live Private Payments API/PER availability.

## Frontend/Backend Wiring Audit

- Join: `UserStatus` calls `sdk.join()`, SDK calls Anchor `join()`.
- Complete setup: `UserStatus` and modal call `completeSetup`, creating UserState and default wSOL balance.
- Add mint: `BalanceList` calls `sdk.addMint(mint)`, with user state, user balance PDA, permission PDA, system program, and PER permission program.
- Deposit: `ActionPanel` calls `sdk.deposit()`. SDK derives user ATA and vault ATA, creates vault ATA if missing, and passes owner, UserState, UserBalance, mint, token program, associated token program, system program, and rent.
- Send/batch send: `ActionPanel` builds transfer items and calls `transferBatchChunked`. SDK uses `transfer_batch` and orders remaining accounts as recipient UserState then recipient UserBalance per recipient, matching Rust validation.
- External fallback send: SDK creates missing recipient ATAs and calls `external_send_batch` with recipient ATAs in remaining accounts.
- Delegate: SDK calls `delegate_user_state_and_balances` with macro-generated user-state delegation accounts and per-mint remaining balance/buffer/record/metadata accounts.
- Commit/undelegate: SDK calls `commit_and_undelegate_user_state_and_balances` with user state and per-mint balance PDAs.
- Withdraw: SDK creates destination ATA if missing and calls `withdraw` with vault authority, vault ATA, and destination ATA. Rust signs vault transfer with vault authority seeds.

## Remaining Risks / Blockers

- `idl:sync` is honest but imperfect: `cargo build-sbf` does not generate `programs/sable/target/idl/sable.json`, so sync falls back to checked-in SDK IDL. Use full Anchor IDL generation before changing Rust instruction shapes.
- Live MagicBlock ER/PER behavior was not verified against remote infrastructure. Local tests verify instruction/account logic, not live router/indexer behavior.
- Private Payments API is only configured when env vars are set. The SDK adapter and mock service exist, but the app no longer assumes a live endpoint.
- The UI does not preflight recipient joined/mint-added status for internal transfers; missing recipient PDAs will surface as transaction errors.
- App build still logs `bigint` native binding fallback and Node localStorage warning during static generation. Build exits successfully.

## Demo Script

Reliable local/devnet path:

1. Start a local validator or configure devnet RPC:
   `solana-test-validator`
2. Ensure the wallet/keypair has SOL.
3. Create a test mint and mint demo tokens:
   `pnpm dev:create-test-mint -- --rpc=http://127.0.0.1:8899 --amount=1000 --decimals=6`
4. Copy the printed mint address.
5. Start the app:
   `pnpm app:dev`
6. Open `http://localhost:3000` and connect wallet.
7. Create treasury / complete setup.
8. Add the printed test mint.
9. Deposit a small amount using the Deposit tab.
10. In a second wallet, join/complete setup and add the same mint.
11. Send to the second wallet using Transfer. For multiple joined recipients, use Batch Input with `address,amount` lines.
12. Optional MagicBlock path: delegate accounts from the Privacy tab only when the MagicBlock router/indexer environment is available.
13. Commit/undelegate before withdraw.
14. Withdraw back to your wallet ATA.

For demo narration, say: "Sable has ER delegation hooks and PER permission/session plumbing. Live private reads and Private Payments API funding require configured MagicBlock services, so this demo uses the direct Anchor deposit path unless those endpoints are available."
