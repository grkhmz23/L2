# Agent Chat UX Hardening Report

## Goal
Harden Sable Agent Chat UX so it feels like a real in-app protocol assistant for non-technical users. The user types normal human requests, the agent prepares the correct Sable action, and the user always reviews, approves/rejects, and signs in their wallet.

**Core product rule:** The agent prepares. The user decides. The wallet signs.

---

## UX Changes Made

### 1. AgentChatPanel
- Clean chat layout with clear intro message:
  > "Tell me what you want to do with your Sable treasury. I’ll prepare it, and you approve every transaction."
- Expanded quick action chips:
  - Create my treasury
  - Add USDC
  - Deposit tokens
  - Send tokens
  - Batch send
  - Withdraw
  - Commit / Undelegate
  - Show my settings
- Empty state explains the agent can only help inside Sable.

### 2. AgentMessageList
- User messages right-aligned (amber styling).
- Agent messages left-aligned with category-based visual distinction:
  - **info** — default gray
  - **prerequisite** — amber/yellow
  - **proposal** — green
  - **warning** — red
  - **success** — emerald
  - **rejected** — zinc
  - **error** — rose

### 3. AgentInputBox
- Placeholder examples:
  > "Try: Deposit 1 USDC" / "Try: Send 0.5 USDC to <address>"
- Press **Enter** to send.
- **Shift+Enter** for newline.
- Disabled while proposal execution is pending.
- Prevents duplicate submit.

### 4. AgentProposalCard
Every executable plan shows:
- Plain-English title (e.g., "Deposit 1 USDC into your Sable vault")
- "What I prepared" description
- "What will happen" explanation
- "You will sign with your wallet" reminder
- Amount and asset badges
- Recipient(s) truncated with copy buttons
- Route badge (Direct Sable vault / Internal Sable transfer / MagicBlock ER)
- Required prerequisites in an amber box
- Risk/warning box in rose
- Buttons:
  - **Approve & open wallet** (shows "Open your wallet…" while executing)
  - **Reject**
- No raw JSON visible to normal users.

### 5. AgentExecutionTimeline
Shows simple steps with status indicators:
1. Preparing request
2. Checking treasury
3. Building transaction
4. Waiting for your wallet signature
5. Sending transaction
6. Confirmed / Failed / Rejected

### 6. AgentStateInspector
- Collapsible **"Details for advanced users"** section (collapsed by default).
- Shows Program ID, RPC, Mint, UserState PDA, UserBalance PDA, Vault ATA, Route, Simulation status.

### 7. Plain-language prerequisite handling
Replaced technical prerequisites with friendly messages:
- Wallet not connected → "Please connect your wallet first. I can prepare the next step after that."
- Treasury missing → "You need a Sable treasury before using assets. I can prepare treasury setup for you."
- Insufficient balance → "Your Sable balance is too low for this transfer. You can deposit more or choose a smaller amount."
- Withdraw while delegated → "Your treasury is still in fast MagicBlock mode. I’ll prepare Commit / Undelegate first, then you can withdraw."
- MagicBlock not configured → "Fast MagicBlock mode is not configured in this environment. You can still use direct Sable vault actions."

### 8. Natural language parser improvements
Deterministic planner now understands non-technical phrases:
- "start", "get started", "create account", "make treasury" → CREATE_TREASURY
- "add usdc", "enable usdc", "use usdc" → ADD_MINT
- "put in", "fund", "top up", "deposit" → DEPOSIT
- "send", "pay", "transfer" → INTERNAL_TRANSFER / EXTERNAL_SEND
- "send to many", "batch", "airdrop", "pay list" → BATCH_TRANSFER
- "take out", "cash out", "move back to wallet", "withdraw" → WITHDRAW
- "make fast", "use magicblock", "delegate" → DELEGATE
- "save state", "exit fast mode", "commit", "undelegate" → COMMIT_UNDELEGATE
- "what do I have", "show balance", "explain balance" → EXPLAIN_BALANCES
- "what next", "help", "guide me" → context-aware next step

If the user omits amount/asset/recipient, the agent asks one simple follow-up instead of failing:
- "deposit" → "How much do you want to deposit, and which asset?"
- "send USDC" → "How much USDC do you want to send, and to which wallet address?"
- "withdraw" → "How much do you want to withdraw?"

### 9. Approval guard
Audited execution path and enforced:
- `executePlan(plan, { userApproved: true })` is required.
- Reject button clears proposal and records "Rejected by user. No transaction was sent."
- Closing the proposal does not execute.
- Pressing Enter in chat does not approve.
- LLM/planner output cannot execute directly.
- Unknown/out-of-scope actions cannot execute.
- Transaction execution is linked to a visible proposal ID.

### 10. Wallet signing UX
When user clicks Approve:
- Button text changes to "Open your wallet…"
- Shows: "Your wallet will ask you to review and sign. Sable Agent cannot sign."
- If wallet rejects → "You rejected the wallet request. No transaction was sent."
- If wallet signs → shows sending/confirmed status and copyable tx signature.

### 11. Error formatting
Replaced raw stack traces with friendly messages. Common error mapping:
- User rejected signature
- Insufficient SOL for gas
- Missing token account
- Recipient not initialized
- Simulation failed
- RPC/network error
- Program error

---

## Safety Model
- Agent never signs.
- Agent never holds private keys.
- Agent never auto-submits transactions.
- Agent never bypasses wallet adapter approval.
- Agent never hides transaction details.
- Agent never calls SDK execution unless `userApproved === true`.
- Every executable proposal shows Approve/Sign and Reject.
- Final signing happens through the connected wallet popup/adapter.

---

## Supported Natural Language Examples

| User says | Agent prepares |
|---|---|
| "I want to start" | CREATE_TREASURY |
| "Add USDC" | ADD_MINT |
| "Put 1 USDC in" | DEPOSIT |
| "Send 0.5 USDC to <pubkey>" | INTERNAL_TRANSFER |
| "Take 1 USDC back to my wallet" | WITHDRAW |
| "Make it fast" | DELEGATE |
| "Save state" | COMMIT_UNDELEGATE |
| "What do I have" | EXPLAIN_BALANCES |
| "deposit" (missing fields) | CLARIFY_SABLE_ACTION |
| "send USDC" (missing fields) | CLARIFY_SABLE_ACTION |

---

## Approval/Signing Flow
1. User types natural language.
2. Agent classifies scope (local, no LLM call for out-of-scope).
3. Deterministic planner parses intent and fields.
4. If fields missing → friendly follow-up question.
5. If fields present → build proposal with prerequisites and warnings.
6. If blocked → explain why in plain language.
7. If ready → show AgentProposalCard with Approve & open wallet / Reject.
8. User clicks Approve → executeAgentPlan with `userApproved: true`.
9. Wallet popup asks for signature.
10. On success → show copyable signature.
11. On reject/failure → explain what happened and next steps.

---

## Commands Run
```bash
pnpm install
pnpm app:typecheck
pnpm app:lint
pnpm app:smoke
pnpm app:build
pnpm build:all
```

All green.

---

## Remaining Risks
- LLM provider integration (DeepSeek/Gemini/Groq) is optional and falls back to deterministic planner.
- MagicBlock ER/PER live endpoints require credentials and are mocked in local dev.
- Transaction simulation inside the wallet is the real guard; the chat simulation box is informational only.
- User must still review wallet popup details; the agent summary is a helper, not a replacement.

---

## Demo Script
1. Open Sable app.
2. Go to Agent Chat.
3. Type: "I want to start."
4. Agent prepares treasury setup.
5. Click Approve & open wallet.
6. Show wallet popup and sign.
7. Type: "Add USDC."
8. Approve/sign.
9. Type: "Put 1 USDC in."
10. Agent prepares deposit.
11. Approve/sign.
12. Type: "Send 0.1 USDC to <recipient>."
13. Reject once to show safety.
14. Ask again and approve/sign.
15. Type: "Take 0.5 USDC back to my wallet."
16. If needed, agent prepares Commit / Undelegate first.
