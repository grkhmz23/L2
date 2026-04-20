# Sable — Amendment 01: Local-First Build Mode

**Drop this file at the repo root alongside `KIMI_PROMPTS.md`.**

**Read this file BEFORE running any numbered prompt in `KIMI_PROMPTS.md`.** The rules here override the specific done-checklist items they reference. Everything else in `KIMI_PROMPTS.md` stands.

---

## Why this amendment exists

The user has not yet received external credentials from MagicBlock (PER testing RPC endpoint, Private Payments API URL + API key) and has not yet deployed to devnet. Rather than stall the build, Kimi proceeds through all prompts against a **local validator** with **mocked remote services**. When credentials arrive, a short follow-up pass flips mocks to live calls. All production code stays real throughout — only transport to hosted services is mocked.

---

## Global rule additions (append to Meta-Rules)

Add these rules to the Meta-Rules block Kimi loads at the start of every session:

```
10. LOCAL-FIRST MODE. External credentials (MagicBlock RPC, Private Payments
    API key, devnet deployer keypair) are not yet available. Do not block on
    them. For every prompt that would use them:
      - Write the real production code that calls the real API shape.
      - Run tests against local validator + mocked HTTP servers.
      - Do NOT skip, stub, or no-op the integration — the code must be correct
        on the assumption that credentials will be supplied later via env vars.
      - If a done-checklist item requires live credentials, mark it "DEFERRED
        TO CREDENTIALS PASS" in PROGRESS.md with a reason, and continue.

11. SCHEMA FIDELITY. Before writing any adapter for a MagicBlock hosted service
    (PER sessions, Private Payments API), read the current docs AND the
    reference implementation in https://github.com/magicblock-labs/private-
    payments-demo. Model TypeScript/Rust types against the real shapes you see
    there. Mocks mimic the real schema — only transport is mocked, never the
    data model.

12. NO REORDERING, NO MERGING. Follow KIMI_PROMPTS.md prompt-by-prompt in
    numerical order. Each prompt has a defined scope and done-checklist. If
    you notice related work that belongs in a later prompt, LEAVE IT for that
    prompt. Do not propose merging prompts. Do not ask "should I do X or Y?" —
    the order is fixed.
```

---

## Per-prompt amendments

### Prompt 3 — run in LOCAL-ONLY MODE

**Original scope:** generate program keypair, update declare_id! everywhere, run deploy-devnet.sh, run init-devnet.ts on devnet.

**Amended scope:**

- Generate program keypair (via `solana-keygen grind` or regular `solana-keygen new`).
- Update `declare_id!` in `programs/sable/src/lib.rs`.
- Update `[programs.localnet]` AND `[programs.devnet]` in `Anchor.toml` with the same pubkey.
- Export `PROGRAM_ID_DEVNET` constant from `@sable/common`.
- Update `.env.example` with `SABLE_PROGRAM_ID=<the generated pubkey>`.
- Write `scripts/deploy-devnet.sh` and `scripts/init-devnet.ts` as before — they must be complete, runnable scripts.
- **DO NOT run `scripts/deploy-devnet.sh` against devnet.**
- **DO NOT run `scripts/init-devnet.ts` against devnet.**
- **DO** verify both scripts at least parse/compile (shellcheck for bash, tsc for TS) and print their help text without errors.

**Amended done-checklist:**

- [ ] `grep -r "SABLE_PROGRAM_ID_TBD" .` returns zero
- [ ] `grep -r "L2CnccKT1q" .` returns zero
- [ ] `declare_id!` matches pubkey in keys/sable-program-keypair.json
- [ ] Anchor.toml localnet + devnet both point at the real program ID
- [ ] `bash -n scripts/deploy-devnet.sh` succeeds (script parses)
- [ ] `pnpm exec tsx --check scripts/init-devnet.ts` succeeds (script compiles)
- [ ] `.env.example` has all required keys
- [ ] Local validator test: `anchor test` compiles the program against the new ID and passes existing tests
- [ ] PROGRESS.md records: "Devnet deploy DEFERRED TO CREDENTIALS PASS — pending deployer SOL"
- [ ] Commit: "sable: prompt 3 — program id (local-only mode)"

---

### Prompt 11 — PER permissions run LOCALLY via program clone

**Original:** tests pass on local validator with PER permission program cloned in.

**Amended:** this is already the local-friendly path. No change to scope. One clarification:

- The PER permission program ID is public on MagicBlock's devnet. Kimi must find and hardcode it in `scripts/test-validator.sh` via `--clone-upgradeable-program <PER_PERMISSION_PROGRAM_ID> --url devnet`. If Kimi cannot locate the exact program ID from public docs, ask the user before guessing.
- The delegation program ID for ER is also public — same treatment.

**Amended done-checklist additions:**

- [ ] Test validator script clones both programs from devnet (document exact program IDs used in `ARCHITECTURE.md`)
- [ ] If a program ID could not be located publicly, mark as BLOCKED in PROGRESS.md and ask the user — do not guess

---

### Prompt 15 — PER sessions against a LOCAL MOCK MIDDLEWARE

**Original:** openSession works against MagicBlock test endpoint.

**Amended scope:**

- Write `packages/sdk/src/session.ts` exactly as specified.
- Before writing, read:
  - https://docs.magicblock.gg/pages/private-ephemeral-rollups-pers/api-reference/per/introduction
  - `github.com/magicblock-labs/private-payments-demo` — look at how their hooks handle the challenge-sign-key exchange
  - Model `SableSession` types against the real schema you see there
- Create `services/per-mock-middleware/` — a small Node service that simulates the PER middleware's challenge/auth flow:
  - `GET /challenge?pubkey=<x>` returns a random challenge string
  - `POST /session { pubkey, challenge, signature }` verifies ed25519, issues a session key keypair, returns `{ sessionPubkey, sessionSecret, expiry }`
  - `GET /balance?account=<pda>&session=<key>` verifies session key signature and returns the balance (reads from local validator)
- `tests/sdk-session.test.ts` runs against this mock middleware, not against MagicBlock's endpoint.
- Create `tests/sdk-session.live.test.ts` gated behind `SABLE_RUN_LIVE_TESTS=1` that hits the real MagicBlock endpoint with the same assertions. This test does not run in CI by default.

**Amended done-checklist:**

- [ ] Mock middleware service builds and runs locally on a fixed port
- [ ] `tests/sdk-session.test.ts` passes against mock middleware
- [ ] `tests/sdk-session.live.test.ts` exists and is structurally complete (would pass given real credentials)
- [ ] Schema comment at the top of `session.ts` references the exact docs URL the types were modeled from
- [ ] PROGRESS.md records: "Live session test DEFERRED TO CREDENTIALS PASS"
- [ ] Commit: "sable: prompt 15 — PER sessions (mocked-first)"

---

### Prompt 16 — Private Payments API against a LOCAL MOCK SERVER

**Original:** live test passes against the real API.

**Amended scope:**

- Write `packages/sdk/src/payments.ts` exactly as specified.
- Before writing, read:
  - https://docs.magicblock.gg/pages/private-ephemeral-rollups-pers/api-reference/per/introduction (Private Payments API section)
  - `github.com/magicblock-labs/private-payments-demo` — study the request/response shapes
  - `github.com/magicblock-labs/mirage` CLI — look at the actual HTTP calls it makes
  - Model `SablePayments` types against these real shapes
- Create `services/payments-api-mock/` — a Node service that mirrors the Private Payments API endpoint shape:
  - Endpoints: deposit, transfer, withdraw, balance, mint-init-status, init-mint, aml-screen
  - Returns realistic response shapes (build unsigned transactions the mock can actually serialize)
  - AML endpoint has a hardcoded OFAC test list for deterministic rejection testing
- `tests/sdk-payments.test.ts` runs against this mock server.
- `tests/sdk-payments.live.test.ts` gated behind `SABLE_RUN_LIVE_TESTS=1` hits the real API.

**Amended done-checklist:**

- [ ] Mock API server builds and runs locally on a fixed port
- [ ] `tests/sdk-payments.test.ts` passes against mock (happy path + AML rejection + invalid mint)
- [ ] `tests/sdk-payments.live.test.ts` exists and is structurally complete
- [ ] Schema comment at the top of `payments.ts` references the exact docs URL and at least one reference implementation file path
- [ ] PROGRESS.md records: "Live Private Payments API test DEFERRED TO CREDENTIALS PASS"
- [ ] Commit: "sable: prompt 16 — Private Payments API adapter (mocked-first)"

---

### Prompt 17 — x402 facilitator against LOCAL SABLE + MOCK MERCHANT

**Original:** service routes real payments through Sable on a live endpoint.

**Amended scope:**

- Write `services/x402-facilitator/` exactly as specified.
- Before writing, confirm x402 header format against https://www.x402.org spec.
- Test flow uses:
  - Local validator running Sable program
  - Local mock merchant (new test fixture) exposing a paid endpoint
  - Local facilitator service
  - All three running via `scripts/test-x402.sh`
- No external services involved. This prompt was already essentially local — just confirm.

**Amended done-checklist additions:**

- [ ] All three components (mock merchant, facilitator, Sable program) run locally via a single script
- [ ] No live hosted endpoints referenced in tests

---

### Prompt 19 — Treasury console uses MOCKED payments adapter by default

**Original:** "All primary flows work against devnet with a real wallet."

**Amended scope:**

- Build the Treasury view as specified.
- Integration: when `NEXT_PUBLIC_SABLE_USE_LIVE_PAYMENTS=true`, use the real `SablePayments` adapter; otherwise use the mock server from Prompt 16.
- For component tests: mock `SableClient` as specified.
- For manual verification: `pnpm app:dev` against the local validator + mocked payments server. The UI should work end-to-end in this configuration.

**Amended done-checklist:**

- [ ] `pnpm app:dev` renders `/app` without console errors against local validator + mocked payments
- [ ] Fund flow completes against mocked Private Payments API
- [ ] Delegation flow completes against local validator with delegation program cloned
- [ ] Session-gated balance reads work against mock PER middleware (from Prompt 15)
- [ ] PROGRESS.md records: "Devnet + live payments verification DEFERRED TO CREDENTIALS PASS"
- [ ] Commit: "sable: prompt 19 — treasury console (local-mode verified)"

---

### Prompt 22 — x402 live demo against LOCAL facilitator

**Original:** single weather call completes end-to-end; 100-call run works.

**Amended scope:**

- Build the x402 demo view as specified.
- The "Weather API" merchant endpoint is a local Next.js API route using the facilitator middleware from Prompt 17.
- All x402 calls go to the local facilitator service.
- No reference to a hosted facilitator URL.
- Env var `NEXT_PUBLIC_SABLE_X402_FACILITATOR_URL` defaults to `http://localhost:<port>` for local dev.

**Amended done-checklist:**

- [ ] Single weather call completes end-to-end against local facilitator
- [ ] 100-call run completes in under 30s against local facilitator
- [ ] Demo GIF recorded from local setup
- [ ] PROGRESS.md records: "Hosted facilitator deploy DEFERRED TO CREDENTIALS PASS"
- [ ] Commit: "sable: prompt 22 — x402 live demo (local-mode)"

---

### Prompt 23 — integration tests against LOCAL FIXTURES ONLY

**Original:** 8 specs green on local, including `08-private-payments-api.spec.ts` which hit the real API.

**Amended scope:**

- All 8 specs run against local fixtures: local validator + mock PER middleware + mock Private Payments API + local x402 facilitator.
- Spec 05 (delegation) uses cloned delegation program.
- Spec 06 (PER permissions) uses cloned PER permission program.
- Spec 08 (Private Payments API) runs against the mock server from Prompt 16.
- Add a separate file `tests/integration/live/` mirroring the 8 specs but gated behind `SABLE_RUN_LIVE_TESTS=1`. These are structurally complete but do not run in CI.

**Amended done-checklist:**

- [ ] `pnpm test:integration` runs all 8 specs green against local fixtures
- [ ] `pnpm test:integration:live` command exists and executes the live-gated counterpart suite (will fail without credentials — this is expected)
- [ ] Conservation check passes in every local spec
- [ ] PROGRESS.md records: "Live integration run DEFERRED TO CREDENTIALS PASS"
- [ ] Commit: "sable: prompt 23 — integration tests (local + live-gated)"

---

### Prompt 24 — devnet deployment (THE CREDENTIALS PASS)

**Original:** full devnet deployment, smoke test, hosted services.

**Amendment:** this prompt stays exactly as written. It is THE credentials pass. Everything deferred above gets executed here.

**Additional work Prompt 24 must handle (beyond what's already in KIMI_PROMPTS.md):**

Before starting Prompt 24, the user will provide:

- `SABLE_DEPLOYER_KEYPAIR` (path to funded deployer keypair)
- `SABLE_MAGICBLOCK_RPC` (PER testing endpoint URL)
- `SABLE_PRIVATE_PAYMENTS_API_URL` + `SABLE_PRIVATE_PAYMENTS_API_KEY`
- `SABLE_USDC_MINT` (devnet USDC mint — confirmed with MagicBlock)

Prompt 24's run sequence:

1. Execute the original Prompt 24 scope (deploy, init, hosted services).
2. Flip every `.live.test.ts` gate on: `SABLE_RUN_LIVE_TESTS=1 pnpm test:integration:live`.
3. Fix any schema mismatches discovered — these are the small rewrites I warned about earlier. Expected scope: field renames, header tweaks, maybe an enum value. If the diff is larger than ~100 lines, PAUSE and flag for human review.
4. Re-run the local suite to ensure no regressions.
5. Re-run the live suite to ensure green.
6. Update `PROGRESS.md`: mark every "DEFERRED TO CREDENTIALS PASS" entry as resolved, with commit SHA.

**Amended done-checklist additions to Prompt 24:**

- [ ] Every "DEFERRED TO CREDENTIALS PASS" note in PROGRESS.md is now resolved
- [ ] `pnpm test:integration` AND `pnpm test:integration:live` both pass
- [ ] Schema reconciliation diff documented in `docs/schema-reconciliation.md` (what changed between the mocks and the real API, why)
- [ ] Commit: "sable: prompt 24 — credentials pass and devnet deploy"

---

### Prompt 25 — no amendment

Prompt 25 is documentation only. Runs unchanged after Prompt 24 completes.

---

## PROGRESS.md changes

Add a new column `Deferred` to the tracker table. Values: `—` (nothing deferred), `CREDS` (waiting on credentials), `RESOLVED` (deferred item completed in Prompt 24).

Example after Prompts 1–15:

| # | Prompt | Status | Commit | Deferred | Notes |
|---|---|---|---|---|---|
| 1 | Rebrand & cleanup | ✅ | abc123 | — | |
| 2 | ER delegation CPI | ✅ | def456 | — | |
| 3 | Program ID | ✅ | 789abc | CREDS | devnet deploy in Prompt 24 |
| 4 | Agent hierarchy | ✅ | ... | — | |
| 5 | Policy engine | ✅ | ... | — | |
| ... | ... | ... | ... | ... | ... |
| 15 | PER sessions | ✅ | ... | CREDS | live test in Prompt 24 |

---

## Quick reference: what runs locally, what defers

| Area | Local | Deferred to credentials pass |
|---|---|---|
| Anchor program (all instructions) | ✅ full coverage via local validator | — |
| ER delegation CPI | ✅ via cloned delegation program | — |
| PER permissions CPI | ✅ via cloned PER permission program | — |
| PER session keys | ✅ via mock middleware service | Live endpoint test |
| Private Payments API | ✅ via mock API server | Live API call test |
| x402 facilitator | ✅ fully local | — |
| Treasury UI | ✅ against local mocks | Live payment flow |
| Agent UI | ✅ against local validator | — |
| Auction UI | ✅ against local validator | — |
| x402 demo UI | ✅ against local facilitator | Hosted facilitator URL |
| Integration tests | ✅ 8 specs local | 8 specs live-gated |
| Devnet program deploy | ❌ | ✅ Prompt 24 |
| Vercel deployment | ❌ | ✅ Prompt 24 |
| Railway / Fly deployment | ❌ | ✅ Prompt 24 |
| Demo video recording | ❌ | ✅ Prompt 25 |

---

## One-line summary for Kimi

**Build everything. Test everything against local validator + local mocks. Mark things "DEFERRED TO CREDENTIALS PASS" in PROGRESS.md. The user will supply credentials before Prompt 24 and we'll flip mocks to live in one pass.**
