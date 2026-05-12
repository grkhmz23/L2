# Sable Hackathon Demo Video Script

## Overview
A 2-minute demo video showcasing Sable's Agent Chat UX for the MagicBlock Privacy Track hackathon. The narrative flows from treasury creation → adding assets → depositing → sending → withdrawing, all through natural language conversation with the Sable Agent.

## Tone
- Confident but not hype-y
- Focus on "agent prepares, user decides, wallet signs"
- Show real transactions on devnet (or realistic mock state)

## Video Specs
- **Target length:** 2:00–2:30
- **Resolution:** 1920×1080
- **Background music:** Optional, low-volume ambient electronic
- **Cursor:** Highlighted/large for visibility

---

## Scene 1: Landing & Connect Wallet (0:00–0:15)

**Screen:** Sable landing page (`/`)

**Narration:**
> "Sable is a privacy-first agent treasury on Solana. Let me show you how a non-technical user can manage funds through natural language."

**Actions:**
1. Show landing page hero.
2. Click "Launch App" or navigate to `/app`.
3. Click "Select Wallet" → choose Phantom.
4. Wallet connects. Address appears in header.

**On-screen text overlay:**
> "Sable Agent Treasury — MagicBlock Hackathon"

---

## Scene 2: Open Agent Chat (0:15–0:25)

**Screen:** `/app/agents` — Agent Chat panel

**Narration:**
> "This is the Agent Chat. Instead of navigating forms, I just tell the agent what I want to do."

**Actions:**
1. Pan/zoom to Agent Chat panel.
2. Show intro message: *"Tell me what you want to do with your Sable treasury. I’ll prepare it, and you approve every transaction."*
3. Briefly hover over quick-action chips.

---

## Scene 3: Create Treasury (0:25–0:45)

**Screen:** Agent Chat

**Narration:**
> "Let's start. I want to create my treasury."

**Actions:**
1. Type: `I want to start` → hit Enter.
2. Agent responds with proposal card: *"Create your Sable treasury"*
3. Click **"Approve & open wallet"**.
4. Wallet popup appears (Phantom sign transaction).
5. Click **Approve** in wallet.
6. Transaction confirms. Success message appears with signature.
7. Copy signature chip flashes briefly.

**On-screen text:**
> "Step 1: Create Treasury"

---

## Scene 4: Add USDC (0:45–1:00)

**Screen:** Agent Chat

**Narration:**
> "Now I need to add USDC so I can use it."

**Actions:**
1. Type: `Add USDC` → hit Enter.
2. Proposal card: *"Add USDC to your treasury"*
3. Click **Approve & open wallet**.
4. Sign in Phantom.
5. Success message appears.

**On-screen text:**
> "Step 2: Add Asset"

---

## Scene 5: Deposit (1:00–1:20)

**Screen:** Agent Chat

**Narration:**
> "Let's deposit one USDC into my vault."

**Actions:**
1. Type: `Put 1 USDC in` → hit Enter.
2. Proposal card shows:
   - Title: *"Deposit 1 USDC into your Sable vault"*
   - Description: *"I prepared a deposit. If you approve, your wallet will ask you to sign a transaction..."*
   - Amount badge: `1 USDC`
   - Route: `Direct Sable vault`
3. Click **Approve & open wallet**.
4. Sign in Phantom.
5. Success: *"Deposit submitted."* + signature.

**On-screen text:**
> "Step 3: Deposit"

---

## Scene 6: Send with Rejection (Safety Demo) (1:20–1:35)

**Screen:** Agent Chat

**Narration:**
> "Now let's send some USDC. But first, I'll show the safety model — I can reject any proposal."

**Actions:**
1. Type: `Send 0.1 USDC to <recipient_address>` → hit Enter.
2. Proposal card appears with amount, recipient (truncated), route.
3. Click **Reject**.
4. Agent message: *"Rejected by user. No transaction was sent."*

**On-screen text:**
> "Safety: The user always decides"

---

## Scene 7: Send (Approved) (1:35–1:50)

**Screen:** Agent Chat

**Narration:**
> "Okay, let's actually send it."

**Actions:**
1. Type the same message again: `Send 0.1 USDC to <recipient_address>` → hit Enter.
2. Click **Approve & open wallet**.
3. Sign in Phantom.
4. Success message with signature.

**On-screen text:**
> "Step 4: Send"

---

## Scene 8: Batch Send (1:50–2:05)

**Screen:** Agent Chat

**Narration:**
> "Sable also supports batch sends. I can pay multiple wallets at once."

**Actions:**
1. Type:
   ```
   Batch send 0.05 USDC to:
   <addr1>
   <addr2>
   <addr3>
   ```
2. Proposal card shows recipient chips with copy buttons.
3. Click **Approve & open wallet**.
4. Sign. Success.

**On-screen text:**
> "Step 5: Batch Send"

---

## Scene 9: Delegate to MagicBlock (2:05–2:20)

**Screen:** Agent Chat

**Narration:**
> "For speed, I can delegate my treasury to MagicBlock Ephemeral Rollups."

**Actions:**
1. Type: `Make it fast` → hit Enter.
2. Proposal: *"Enter fast MagicBlock mode for USDC"*
3. Click **Approve & open wallet**.
4. Sign. Success.

**On-screen text:**
> "Step 6: MagicBlock ER Delegation"

---

## Scene 10: Withdraw & Close (2:20–2:30)

**Screen:** Agent Chat

**Narration:**
> "Finally, I want my funds back. If delegated, the agent prepares commit and undelegate first."

**Actions:**
1. Type: `Take 0.5 USDC back to my wallet` → hit Enter.
2. If delegated: Agent says *"Your treasury is still in fast MagicBlock mode. I'll prepare Commit / Undelegate first..."*
3. Or if not delegated: Proposal card for withdrawal.
4. Approve, sign, success.

**On-screen text:**
> "Step 7: Withdraw"

---

## Scene 11: Outro (2:30–2:40)

**Screen:** Landing page or Agent Chat with all success messages

**Narration:**
> "Sable Agent prepares every action. The user decides. The wallet signs. That's the Sable treasury experience."

**On-screen text overlay:**
> "github.com/grkhmz23/Sable"
> "Built for MagicBlock Privacy Track"

---

## Recording Tips

1. **Wallet prep:** Use a fresh Phantom wallet with devnet SOL and USDC. Fund via devnet faucet.
2. **Devnet RPC:** Ensure `NEXT_PUBLIC_SOLANA_RPC_URL` is set to a reliable devnet endpoint.
3. **Screen size:** Set browser to 1440×900 or 1920×1080 for clean capture.
4. **Cursor:** Use a tool like KeyCastr or macOS built-in pointer highlighting.
5. **Pacing:** Pause 1–2 seconds after each agent response so viewers can read.
6. **Zoom:** Zoom in slightly on proposal cards and wallet popups.
7. **No edits needed for wallet popups** — the real signing flow is the best demo.

## Quick Commands for Devnet Setup

```bash
# Ensure devnet config
solana config set --url devnet

# Airdrop SOL
solana airdrop 2

# Get devnet USDC from faucet or use existing ATA
```

## Optional: Pre-seed Treasury for Faster Demo

If you want to skip the create-treasury step in the video, pre-create the treasury off-camera, then start recording from "Add USDC."
