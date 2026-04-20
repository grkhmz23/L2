# Sable Architecture

Sable is a private programmable money layer for AI agents on Solana, built on MagicBlock ER + PER + Private Payments API.

## High-Level Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              Sable Program                               │
├─────────────────────────────────────────────────────────────────────────┤
│  ┌─────────┐  ┌──────────┐  ┌──────────┐  ┌─────────────────────────┐  │
│  │  Config │  │ UserState│  │AgentState│  │   UserBalance/Agent     │  │
│  │ (global)│  │(per user)│  │(per agent│  │      Balance            │  │
│  └─────────┘  └──────────┘  └──────────┘  │   (per owner per mint)  │  │
│                                           └─────────────────────────┘  │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │              Vault Authority PDA                                 │   │
│  │   ┌─────────────────┐  ┌─────────────────┐                      │   │
│  │   │   Vault ATA 1   │  │   Vault ATA 2   │  ...                 │   │
│  │   │   (Mint A)      │  │   (Mint B)      │                      │   │
│  │   └─────────────────┘  └─────────────────┘                      │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌─────────────────────┐   │
│  │   Task   │  │    Bid   │  │TaskEscrow│  │ PER Permission      │   │
│  │ (auction)│  │ (sealed) │  │ (locked) │  │   Metadata          │   │
│  └──────────┘  └──────────┘  └──────────┘  └─────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                   MagicBlock Ephemeral Rollup (ER)                       │
│  - Delegate state for fast/cheap transactions                            │
│  - Commit/Undelegate back to L1 for withdrawals                          │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│              Private Ephemeral Rollup (PER) + Session Keys               │
│  - Account-level READ/WRITE permissions                                  │
│  - Encrypted balances — invisible on L1                                  │
│  - Session-key gated access for agents                                   │
└─────────────────────────────────────────────────────────────────────────┘
```

## Component List

### Core Accounts

| Account | Seeds | Purpose |
|---------|-------|---------|
| `Config` | `["config"]` | Global program config (admin, delegation program ID) |
| `UserState` | `["user_state", owner]` | Per-human identity, tracks agent/task counts |
| `AgentState` | `["agent_state", parent, nonce]` | Per-agent identity, hierarchical tree |
| `UserBalance` | `["user_balance", owner, mint]` | Per-user-per-mint ledger balance |
| `AgentBalance` | `["agent_balance", agent, mint]` | Per-agent-per-mint ledger balance |
| `AgentCounters` | `["agent_counters", agent]` | Running spend counters for policy enforcement |
| `VaultAuthority` | `["vault_authority"]` | PDA owning all vault ATAs |

### Auction Accounts

| Account | Seeds | Purpose |
|---------|-------|---------|
| `Task` | `["task", poster, task_id]` | Auction listing with budget, deadlines, spec hash |
| `Bid` | `["bid", task, bidder]` | Sealed commitment (hash only, no amount) |
| `TaskEscrow` | `["task_escrow", task]` | Locked budget + bid deposits |

### PER Permission Accounts

| Account | Seeds | Purpose |
|---------|-------|---------|
| `PermissionMetadata` | PER-program derived | READ/WRITE gating per balance/escrow |

### Cross-Cutting Concerns

- **Vault Authority**: All vault ATAs are owned by a single PDA. The program signs transfers via PDA seeds.
- **Delegation**: UserState + all balances can be delegated to ER for fast execution. Withdrawals require commit/undelegate first.
- **Policy Engine**: Every agent transfer runs through `validate_spend` which checks per-tx, daily, total, counterparty, mint, and expiry constraints.
- **Conservation Invariant**: `sum(all user balances + all agent balances + all escrow balances) == sum(vault ATA balances)` at all times.

## Agent Hierarchy

```
UserState (root)
  └─ AgentState #1 (depth 1)
       ├─ AgentState #1.1 (depth 2)
       │     └─ AgentState #1.1.1 (depth 3)
       │           └─ AgentState #1.1.1.1 (depth 4)  ← MAX_DEPTH
       └─ AgentState #1.2 (depth 2)
  └─ AgentState #2 (depth 1)
```

- Max depth: 4
- Max agents per parent: 64
- Parent can freeze (reversible) or revoke (irreversible) any descendant
- Only root user can close an agent (and only if child_count == 0 and all balances == 0)

## Sealed-Bid Auction Flow

1. **Create Task**: Poster locks budget in TaskEscrow. Sets commit/reveal deadlines.
2. **Commit Bid**: Bidder submits `keccak256(amount || nonce || bidder_pubkey)` + deposit. Amount is NOT revealed.
3. **Reveal Bid**: Bidder submits `(amount, nonce)`. Chain verifies hash match.
4. **Settle**: Anyone can call after reveal deadline. Lowest revealed bid wins (first-price). Unrevealed deposits forfeit to poster.

### Commit Hash Scheme

The commitment hides the bid amount until the reveal phase:

```
commit_hash = keccak256(
  amount.to_le_bytes(8) ||
  nonce.to_le_bytes(8) ||
  bidder_pubkey(32)
)
```

- **amount**: u64 bid amount, little-endian 8 bytes.
- **nonce**: random u64 generated client-side, little-endian 8 bytes. Must be stored securely by the bidder — without it, reveal is impossible.
- **bidder_pubkey**: the bidder's UserState or AgentState PDA, 32 bytes. Including the bidder pubkey makes commitments non-transferable.

**Worked example:**
- amount = 42.5 USDC = 42_500_000 (6 decimals)
- nonce = 0x9f86d081884c7d659a2feaa0c55ad015
- bidder = `SaSAXcdWhyr1KD8TKRg6K7WPuxcPLZJHKEwsjQgL5Di`
- hash = `keccak256([0x80, 0x2c, 0x86, 0x02, 0x00, 0x00, 0x00, 0x00, 0x15, 0xd0, 0x5a, 0xc5, 0xa0, 0xfe, 0xa2, 0x59, 0xd6, 0xc7, 0x84, 0x88, 0x81, 0xd0, 0x86, 0x9f, ...bidder_bytes])`

## x402 Payment Flow

1. Agent calls merchant API without payment header
2. Merchant returns `402 Payment Required` with price + receiver
3. Agent's x402 client builds a signed Sable `agent_transfer` tx payload
4. Agent retries with `X-PAYMENT` header
5. Merchant's facilitator verifies signature + nonce, then settles via Sable PER
6. Agent receives API response

## External Services

| Service | Purpose | Stack |
|---------|---------|-------|
| `app` | Treasury console, agent dashboard, auction marketplace, x402 demo | Next.js 14 |
| `x402-facilitator` | HTTP service verifying & settling x402 payments | Node/Express |
| `Private Payments API` | Hosted USDC on/off-ramp with AML/OFAC compliance | MagicBlock |

## Tech Stack

- **Program**: Anchor 0.32.1, Rust 1.85.0, Solana 2.3.13
- **SDK**: TypeScript, `@coral-xyz/anchor`, `@solana/web3.js`
- **App**: Next.js 14, Tailwind CSS, `@solana/wallet-adapter-react`
- **PER**: MagicBlock ephemeral-rollups-sdk 0.8.8+

## Invariants

1. **Conservation**: Token supply in vaults equals sum of all ledger balances + escrows.
2. **Policy**: Every agent debit runs through `validate_spend`; no bypass exists.
3. **Delegation**: Withdrawals and external sends are blocked while delegated.
4. **Auction Sealing**: Commit hash hides amount until reveal; non-transferable via bidder pubkey in hash.
5. **Hierarchy**: Child count tracks descendants; close requires zero children and zero balances.
