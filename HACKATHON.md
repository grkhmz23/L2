# MagicBlock Privacy Track — Colosseum Hackathon

Privacy is the primitive for the next generation of on-chain applications —
especially in a world of autonomous agents. This track challenges you to
build privacy-first systems on Solana, powered by MagicBlock's (Private)
Ephemeral Rollups & Payment API:

- Ephemeral Rollup (ER)
- Private Ephemeral Rollup (PER)
- Private Payments API

Focus areas:
- Private payments & shielded transactions
- Private DeFi (Auctions, Lending, Trading primitives)
- Agentic commerce, Agent-to-agent, x402 APIs, MPP

Prizes: 1st $2,500 · 2nd $1,500 · 3rd $1,000

Judging:
- Technology 40%: effective use of ER/PER/Payments API, working demo,
  architecture
- Impact 30%: real-world problem, market need, adoption potential
- Creativity & UX 30%: novel primitives, smooth UX, clarity

## Sable Scope

Sable is a Solana agent treasury prototype with real Anchor instructions for
vault-backed balances, agent policies, internal transfers, delegation hooks,
and sealed-bid auctions. It touches all three focus areas, but some privacy and
payments pieces are integration hooks rather than fully verified live services:

- Private payments: SDK adapter and mock service exist. Live Private Payments
  API use is env-driven and should be demoed only if endpoint credentials work.
- Private DeFi: sealed-bid agent auctions with commit/reveal mechanics.
- Agentic commerce: hierarchical agent treasuries with on-chain spend
  policies + an x402 facilitator for pay-per-API commerce.

MagicBlock primitives used:
- ER delegation and commit/undelegate hooks for UserState/UserBalance accounts
- PER permission metadata plus SDK session hooks for middleware-backed reads
- Private Payments API adapter and local mock path for USDC funding experiments
