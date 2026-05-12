# Sable Agent Chat — Investor Demo Script

> **Pitch:** "The agent prepares. The user decides. The wallet signs."

This is a 3-minute walkthrough of the Sable Agent Chat showing natural-language treasury management with hard safety guarantees.

---

## Scene 1: Onboard — "I want to start"

**User types:**
```
I want to start
```

**Agent responds (message bubble):**
> I prepared: Create your Sable treasury
>
> Review the proposal, then click Approve & open wallet to sign.

**Proposal card appears:**
- **Title:** "Create your Sable treasury"
- **Description:** "I prepared treasury creation. If you approve, your wallet will ask you to sign a transaction. This creates your Sable treasury on-chain. The agent cannot sign this for you."
- **Route:** Direct Sable vault
- **Risk:** LOW

**Action:** Click **Approve & open wallet** → Phantom popup → Approve

**Result:** Success message with transaction signature.

**Investor takeaway:** "No forms, no jargon. The user just says 'I want to start' and the agent prepares the correct on-chain action. The wallet — not the agent — signs."

---

## Scene 2: Add Asset — "Add USDC"

**User types:**
```
Add USDC
```

**Agent responds:**
> I prepared: Add USDC to your treasury
>
> Review the proposal, then click Approve & open wallet to sign.

**Proposal card:**
- **Title:** "Add USDC to your treasury"
- **Description:** "I prepared adding an asset. If you approve, your wallet will ask you to sign a transaction. This creates a balance tracking account for USDC in your treasury."
- **Asset:** USDC
- **Route:** Direct Sable vault

**Action:** Approve & sign

**Result:** USDC balance PDA created.

**Investor takeaway:** "Assets are added by name, not by typing mint addresses. The agent knows USDC, wSOL, and any custom mint."

---

## Scene 3: Deposit — "Put 1 USDC in"

**User types:**
```
Put 1 USDC in
```

**Agent responds:**
> I prepared: Deposit 1 USDC into your Sable vault
>
> Review the proposal, then click Approve & open wallet to sign.

**Proposal card:**
- **Title:** "Deposit 1 USDC into your Sable vault"
- **Description:** "I prepared a deposit. If you approve, your wallet will ask you to sign a transaction. This moves 1 USDC from your wallet into your Sable vault. The agent cannot sign this for you."
- **Amount:** 1 USDC
- **Route:** Direct Sable vault
- **Warning box:** "Sable Agent only prepares this action. Your wallet must approve and sign."

**Action:** Approve & sign

**Result:** "Deposit submitted." + copyable signature.

**Investor takeaway:** "Plain English — 'put in' — maps to a vault deposit. The user sees exactly what will happen before signing."

---

## Scene 4: Safety Demo — Send, then Reject

**User types:**
```
Send 0.1 USDC to 7abc...xyz
```

**Agent responds:**
> I prepared: Send 0.1 USDC to 7abc...xyz
>
> Review the proposal, then click Approve & open wallet to sign.

**Proposal card:**
- **Title:** "Send 0.1 USDC to 7abc…xyz"
- **Amount:** 0.1 USDC
- **Recipient:** 7abc…xyz [Copy button]
- **Route:** Internal Sable transfer
- **Buttons:** [Reject] [Approve & open wallet]

**Action:** Click **Reject**

**Agent responds:**
> Rejected by user. No transaction was sent.

**Investor takeaway:** "The agent can never execute without explicit approval. Rejecting is instant, safe, and leaves no trace. This is the core safety model."

---

## Scene 5: Send — Approve & Sign

**User types again:**
```
Send 0.1 USDC to 7abc...xyz
```

**Agent responds with the same proposal.**

**Action:** Click **Approve & open wallet** → Phantom popup → Approve

**Result:** "Prepared transfer signed in 1 transaction(s)." + signature.

**Investor takeaway:** "The user reviews the exact amount and recipient, then signs in their own wallet. The agent never touches private keys."

---

## Scene 6: Scale — "Send 0.05 USDC to these 5 wallets"

**User types:**
```
Send 0.05 USDC to these wallets:
1111...aaaa
2222...bbbb
3333...cccc
4444...dddd
5555...eeee
```

**Agent responds:**
> I prepared: Batch send USDC to 5 recipient(s)
>
> Review the proposal, then click Approve & open wallet to sign.

**Proposal card:**
- **Title:** "Batch send USDC to 5 recipient(s)"
- **Description:** "I prepared a batch send. If you approve, your wallet will ask you to sign one or more transactions. This updates balances inside Sable for all recipients."
- **Amount:** 0.05 USDC each
- **Recipients:** 5 chips with truncated addresses + Copy buttons
- **Route:** Direct Sable vault
- **Warning:** "Batch sends may require multiple wallet approvals when chunked."

**Action:** Approve & sign (one or more tx popups depending on chunking)

**Result:** Success with all signatures.

**Investor takeaway:** "Natural language batching. One sentence pays five wallets. No CSV uploads, no loop logic, no custom scripts."

---

## Scene 7: MagicBlock — "Make it fast"

**User types:**
```
Make it fast
```

**Agent responds:**
> I prepared: Enter fast MagicBlock mode for USDC
>
> Review the proposal, then click Approve & open wallet to sign.

**Proposal card:**
- **Title:** "Enter fast MagicBlock mode for USDC"
- **Description:** "I prepared delegation to MagicBlock. If you approve, your wallet will ask you to sign a transaction. This enters fast mode for low-cost execution. The agent cannot sign this for you."
- **Route:** MagicBlock ER
- **Warning:** "MagicBlock delegation only works when router and delegation services are configured."

**Action:** Approve & sign

**Result:** Delegation transaction confirmed.

**Investor takeaway:** "One phrase — 'make it fast' — delegates the treasury to MagicBlock Ephemeral Rollups. This is the only Solana agent treasury with native ER integration."

---

## Scene 8: Commit Back — "Save state"

**User types:**
```
Save state
```

**Agent responds:**
> I prepared: Save fast-mode changes back to Solana
>
> Review the proposal, then click Approve & open wallet to sign.

**Proposal card:**
- **Title:** "Save fast-mode changes back to Solana"
- **Description:** "I prepared commit and undelegate. If you approve, your wallet will ask you to sign a transaction. This saves fast-mode changes back to Solana so you can withdraw. The agent cannot sign this for you."
- **Route:** MagicBlock ER → L1

**Action:** Approve & sign

**Result:** Commit / undelegate confirmed.

**Investor takeaway:** "The user controls the full ER lifecycle — delegate for speed, commit back for finality. All through natural language."

---

## Scene 9: Withdraw — "Take 0.5 USDC back"

**User types:**
```
Take 0.5 USDC back to my wallet
```

**Agent responds:**
> I prepared: Withdraw 0.5 USDC to your wallet
>
> Review the proposal, then click Approve & open wallet to sign.

**Proposal card:**
- **Title:** "Withdraw 0.5 USDC to your wallet"
- **Amount:** 0.5 USDC
- **Route:** Direct Sable vault

**Action:** Approve & sign

**Result:** Withdrawal submitted + signature.

**Investor takeaway:** "Exit is as simple as entry. 'Take back' maps to a secure vault withdrawal. The agent never custodies funds."

---

## Full Demo Flow (Recommended Order)

For investors, run these 6 messages in order:

1. `I want to start` → Create treasury
2. `Add USDC` → Add asset
3. `Put 1 USDC in` → Deposit
4. `Send 0.1 USDC to <address>` → **Reject first** (safety demo), then approve
5. `Make it fast` → MagicBlock delegation
6. `Take 0.5 USDC back to my wallet` → Withdraw

Total time: ~2 minutes.

---

## Narration Tips for Investors

**Open with:**
> "Most DeFi products are built for developers. Sable is built for humans."

**During safety demo:**
> "The agent can prepare, but it can never execute. If the user rejects, nothing happens. The wallet — not the agent — holds the keys."

**During MagicBlock:**
> "This is the only agent treasury with native MagicBlock integration. 'Make it fast' delegates to an ephemeral rollup for sub-second execution."

**Close with:**
> "Sable Agent prepares every action. The user decides. The wallet signs."
