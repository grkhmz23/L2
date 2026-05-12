# Sable Demo Video — Visual Storyboard

## Video Specs
- **Duration:** 2:00–2:30
- **Resolution:** 1920×1080 (record at 1440×900 and scale, or native 1920×1080)
- **Browser:** Chrome/Brave, zoom 100%
- **Cursor:** Large/highlighted
- **Font:** System default (Outfit + JetBrains Mono already loaded)

---

## Scene 1: Landing Page (0:00–0:15)

**Visual:**
```
┌────────────────────────────────────────────────────────────────────┐
│  Sable  ← logo                                    Select Wallet    │
│                                                                    │
│         Privacy-first agent treasury on Solana                     │
│         Vault-backed balances · Sealed-bid tasks · x402 payments   │
│                                                                    │
│              [ Launch App ]                                        │
│                                                                    │
│  Built for MagicBlock Privacy Track                                │
└────────────────────────────────────────────────────────────────────┘
```

**Narration:** *"Sable is a privacy-first agent treasury on Solana. Let me show you how a non-technical user can manage funds through natural language."*

**Action:** Click "Launch App" → wallet modal opens → select Phantom → connect.

---

## Scene 2: Agent Chat Panel (0:15–0:25)

**Visual:**
```
┌────────────────────────────────────────────────────────────────────┐
│  Sable Agent Chat                                                  │
│  Treasury Actions By Proposal                                      │
│  Tell me what you want to do with your Sable treasury...           │
│                                                                    │
│  ┌──────────────────────────────────────────────────────┐          │
│  │ Tell me what you want to do with your Sable          │  ← agent│
│  │ treasury. I'll prepare it, and you approve every     │         │
│  │ transaction.                                         │         │
│  └──────────────────────────────────────────────────────┘          │
│                                                                    │
│  [Create my treasury] [Add USDC] [Deposit tokens] [Send tokens]   │
│  [Batch send] [Withdraw] [Commit / Undelegate] [Show my settings] │
│                                                                    │
│  ┌────────────────────────────────────┐  ┌────────────────────┐   │
│  │ Ask Sable Agent                    │  │ Execution          │   │
│  │ Try: Deposit 1 USDC                │  │ No active proposal │   │
│  │ Try: Send 0.5 USDC to <address>    │  │                    │   │
│  └────────────────────────────────────┘  └────────────────────┘   │
│                                                                    │
│  [Prepare Proposal]                                                │
└────────────────────────────────────────────────────────────────────┘
```

**Narration:** *"This is the Agent Chat. Instead of navigating forms, I just tell the agent what I want to do."*

---

## Scene 3: Create Treasury (0:25–0:45)

**Visual — User types:**
```
┌────────────────────────────────────────────────────────────────────┐
│  ┌────────────────────────────────────────┐                        │
│  │ I want to start                        │  ← user (amber, right)│
│  └────────────────────────────────────────┘                        │
│                                                                    │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │ I prepared: Create your Sable treasury                     │    │
│  │ Review the proposal, then click Approve & open wallet.     │    │
│  └────────────────────────────────────────────────────────────┘    │
│                                                                    │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │ PROPOSAL              [BLOCKED / LOW / MEDIUM / HIGH]      │    │
│  │ Create your Sable treasury                                 │    │
│  │                                                            │    │
│  │ What I prepared                                            │    │
│  │ I prepared treasury creation. If you approve, your wallet  │    │
│  │ will ask you to sign...                                    │    │
│  │                                                            │    │
│  │ Route: Direct Sable vault                                  │    │
│  │                                                            │    │
│  │ [ Reject ]  [ Approve & open wallet ]                      │    │
│  └────────────────────────────────────────────────────────────┘    │
└────────────────────────────────────────────────────────────────────┘
```

**Narration:** *"Let's start. I want to create my treasury."*

**Action:** Click **Approve & open wallet** → Phantom popup → click **Approve**.

**Visual — Success:**
```
┌────────────────────────────────────────────────────────────────────┐
│  ┌────────────────────────────────────────────────────────────┐    │
│  │ Treasury created.                                          │    │
│  │ Transaction signature:                                     │    │
│  │ 5xK3...aB9m                                [Copy]          │    │
│  └────────────────────────────────────────────────────────────┘    │
└────────────────────────────────────────────────────────────────────┘
```

---

## Scene 4: Add USDC (0:45–1:00)

**Visual — User types:**
```
┌────────────────────────────────────────────────────────────────────┐
│  ┌────────────────────────────────────────┐                        │
│  │ Add USDC                               │  ← user               │
│  └────────────────────────────────────────┘                        │
│                                                                    │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │ Add USDC to your treasury                                  │    │
│  │ ...                                                        │    │
│  │ [Approve & open wallet]                                    │    │
│  └────────────────────────────────────────────────────────────┘    │
└────────────────────────────────────────────────────────────────────┘
```

**Narration:** *"Now I need to add USDC so I can use it."*

**Action:** Approve → sign → success.

---

## Scene 5: Deposit (1:00–1:20)

**Visual — User types:**
```
┌────────────────────────────────────────────────────────────────────┐
│  ┌────────────────────────────────────────┐                        │
│  │ Put 1 USDC in                          │  ← user               │
│  └────────────────────────────────────────┘                        │
│                                                                    │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │ Deposit 1 USDC into your Sable vault                       │    │
│  │                                                            │    │
│  │ Amount: 1 USDC                                             │    │
│  │ Route: Direct Sable vault                                  │    │
│  │                                                            │    │
│  │ Warnings:                                                  │    │
│  │ Sable Agent only prepares this action. Your wallet must    │    │
│  │ approve and sign.                                          │    │
│  │                                                            │    │
│  │ [ Reject ]  [ Approve & open wallet ]                      │    │
│  └────────────────────────────────────────────────────────────┘    │
└────────────────────────────────────────────────────────────────────┘
```

**Narration:** *"Let's deposit one USDC into my vault."*

**Action:** Approve → sign → success with signature.

---

## Scene 6: Send — Rejection Demo (1:20–1:35)

**Visual — User types:**
```
┌────────────────────────────────────────────────────────────────────┐
│  ┌────────────────────────────────────────┐                        │
│  │ Send 0.1 USDC to 7abc...xyz            │  ← user               │
│  └────────────────────────────────────────┘                        │
│                                                                    │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │ Send 0.1 USDC to 7abc...xyz                                │    │
│  │                                                            │    │
│  │ [ Reject ]  [ Approve & open wallet ]                      │    │
│  └────────────────────────────────────────────────────────────┘    │
│                                                                    │
│  Action: Click [Reject]                                            │
│                                                                    │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │ Rejected by user. No transaction was sent.                 │    │
│  └────────────────────────────────────────────────────────────┘    │
└────────────────────────────────────────────────────────────────────┘
```

**Narration:** *"Now let's send some USDC. But first, I'll show the safety model — I can reject any proposal."*

---

## Scene 7: Send — Approved (1:35–1:50)

**Visual:**
```
┌────────────────────────────────────────────────────────────────────┐
│  ┌────────────────────────────────────────┐                        │
│  │ Send 0.1 USDC to 7abc...xyz            │  ← user               │
│  └────────────────────────────────────────┘                        │
│                                                                    │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │ Prepared transfer signed in 1 transaction(s).              │    │
│  │ Transaction signature:                                     │    │
│  │ 3xP9...kL2m                                [Copy]          │    │
│  └────────────────────────────────────────────────────────────┘    │
└────────────────────────────────────────────────────────────────────┘
```

**Narration:** *"Okay, let's actually send it."*

---

## Scene 8: Batch Send (1:50–2:05)

**Visual:**
```
┌────────────────────────────────────────────────────────────────────┐
│  ┌────────────────────────────────────────┐                        │
│  │ Batch send 0.05 USDC to:               │  ← user               │
│  │ 1111...aaaa                            │                        │
│  │ 2222...bbbb                            │                        │
│  │ 3333...cccc                            │                        │
│  └────────────────────────────────────────┘                        │
│                                                                    │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │ Batch send USDC to 3 recipient(s)                          │    │
│  │                                                            │    │
│  │ Recipients (3):                                            │    │
│  │ [1111...aaaa  0.05] [2222...bbbb  0.05] [3333...cccc 0.05] │    │
│  │                                                            │    │
│  │ [ Reject ]  [ Approve & open wallet ]                      │    │
│  └────────────────────────────────────────────────────────────┘    │
└────────────────────────────────────────────────────────────────────┘
```

**Narration:** *"Sable also supports batch sends. I can pay multiple wallets at once."*

---

## Scene 9: Delegate to MagicBlock (2:05–2:20)

**Visual:**
```
┌────────────────────────────────────────────────────────────────────┐
│  ┌────────────────────────────────────────┐                        │
│  │ Make it fast                           │  ← user               │
│  └────────────────────────────────────────┘                        │
│                                                                    │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │ Enter fast MagicBlock mode for USDC                        │    │
│  │                                                            │    │
│  │ Route: MagicBlock ER                                       │    │
│  │                                                            │    │
│  │ [ Reject ]  [ Approve & open wallet ]                      │    │
│  └────────────────────────────────────────────────────────────┘    │
└────────────────────────────────────────────────────────────────────┘
```

**Narration:** *"For speed, I can delegate my treasury to MagicBlock Ephemeral Rollups."*

---

## Scene 10: Withdraw (2:20–2:30)

**Visual:**
```
┌────────────────────────────────────────────────────────────────────┐
│  ┌────────────────────────────────────────┐                        │
│  │ Take 0.5 USDC back to my wallet        │  ← user               │
│  └────────────────────────────────────────┘                        │
│                                                                    │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │ Withdraw 0.5 USDC to your wallet                           │    │
│  │                                                            │
│  │ If delegated, agent prepares Commit / Undelegate first.    │
│  └────────────────────────────────────────────────────────────┘    │
└────────────────────────────────────────────────────────────────────┘
```

**Narration:** *"Finally, I want my funds back. If delegated, the agent prepares commit and undelegate first."*

---

## Scene 11: Outro (2:30–2:40)

**Visual:** Full app view or landing page with all success messages visible.

**Text overlay:**
```
github.com/grkhmz23/Sable
Built for MagicBlock Privacy Track
```

**Narration:** *"Sable Agent prepares every action. The user decides. The wallet signs. That's the Sable treasury experience."*

---

## Recording Checklist

- [ ] Devnet wallet funded with SOL + USDC
- [ ] Treasury pre-created (optional, speeds up demo)
- [ ] USDC mint added (optional)
- [ ] Screen resolution set to 1440×900 or 1920×1080
- [ ] Browser zoom at 100%
- [ ] Cursor highlighting enabled
- [ ] Background music queued (optional)
- [ ] Test-run the full flow once before recording
- [ ] Keep Phantom wallet popup visible — do not crop it out
