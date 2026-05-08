# Sable — Solana Agent Treasury Prototype

Sable is a Solana agent treasury prototype. It combines vault-backed ledger balances, hierarchical agent treasuries, sealed-bid auctions, and an x402 demo path. The program includes MagicBlock ER delegation hooks and PER permission metadata creation, but Private Payments API and live PER balance reads require external services/credentials and should be treated as partially integrated rather than production-ready.

![x402 Demo](docs/x402-demo.gif)

## Live Deployment

| Component | URL |
|---|---|
| App (Treasury Console) | *Pending Prompt 24* |
| x402 Facilitator | *Pending Prompt 24* |
| Program (Devnet) | [SaSAXcdWhyr1KD8TKRg6K7WPuxcPLZJHKEwsjQgL5Di](https://explorer.solana.com/address/SaSAXcdWhyr1KD8TKRg6K7WPuxcPLZJHKEwsjQgL5Di?cluster=devnet) |

## How It Works

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              Sable Program                               │
├─────────────────────────────────────────────────────────────────────────┤
│  UserState ──► AgentState tree ──► AgentBalance/Policy/Counters        │
│       │                                    │                            │
│       ▼                                    ▼                            │
│  UserBalance ◄──── agent_transfer ──► TaskEscrow ◄── Bid               │
│       │                                    │                            │
│       ▼                                    ▼                            │
│  Vault ATA (SPL tokens)              PER Permission Metadata            │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
              ┌─────────────────────┼─────────────────────┐
              ▼                     ▼                     ▼
        Solana L1           MagicBlock ER          MagicBlock PER
        (settlement)        (fast execution)       (private reads)
```

## MagicBlock Primitives

| Primitive | Where | File |
|---|---|---|
| **Ephemeral Rollup (ER)** | Delegate UserState + balances for ER-routed internal transfers | `programs/sable/src/lib.rs` |
| **Private Ephemeral Rollup (PER)** | Permission metadata PDAs plus SDK session hooks for private reads when middleware is available | `programs/sable/src/lib.rs`, `packages/sdk/src/session.ts` |
| **Private Payments API** | Adapter and mock server exist; live endpoint use is env-driven and not assumed by default | `packages/sdk/src/payments.ts`, `services/payments-api-mock/` |

## Quickstart

```bash
# 1. Clone
git clone <repo> && cd sable

# 2. Install
pnpm install

# 3. Build everything
pnpm build:all

# 4. Start local validator
solana-test-validator

# 5. Run tests
pnpm test:integration

# 6. Start the app
pnpm app:dev
```

The app runs at `http://localhost:3000`. Connect your devnet wallet to explore the treasury console, agent dashboard, auction marketplace, and x402 demo.

## Architecture

See [docs/architecture.md](docs/architecture.md) for the system design, account layout, instruction map, and invariants.

## x402 Integration

Third-party merchants can experiment with Sable agent payments through the x402 facilitator. See [docs/x402-integration.md](docs/x402-integration.md) for the middleware integration guide.

## Security

This is hackathon code. It has not been audited. Do not use with real funds without a professional security review.

## License

MIT

---

## Submission Checklist

- [ ] Live app URL
- [ ] Live facilitator URL
- [ ] Devnet program ID (clickable)
- [ ] Demo video link
- [ ] MagicBlock Discord proof of endpoint access
