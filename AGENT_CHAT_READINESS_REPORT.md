# Sable Agent Chat Readiness Report

## What was implemented

- Added shared agent types for messages, intents, action plans, proposals, execution results, risk levels, tool context, and provider responses.
- Added a deterministic rule-based planner that works without any LLM configuration.
- Added `/api/agent` for optional structured LLM planning with DeepSeek, Gemini, and Groq provider selection.
- Added zod validation for LLM JSON output and safe deterministic fallback on missing env, malformed JSON, or provider failure.
- Added a safe context builder for wallet, treasury, known mints, balances, delegation flags, and public app config.
- Added proposal guard logic for prerequisites, blocked actions, risk labels, warnings, accounts touched, and simulation status.
- Added a guarded tool registry through `executeAgentPlan`, which refuses to execute unless `userApproved: true`.
- Added `AgentChatPanel`, `AgentMessageList`, `AgentInputBox`, `AgentProposalCard`, `AgentExecutionTimeline`, and `AgentStateInspector`.
- Mounted the full Agent Chat on the Agents page and a compact assistant panel on the Treasury page.
- Added smoke tests for planner parsing, guard blocking, approval enforcement, LLM fallback, Agent Chat render, proposal render, and reject behavior.

## Safety model

Sable Agent Chat prepares proposals only. It never signs, stores private keys, submits hidden transactions, bypasses wallet approval, or executes without an explicit UI approval.

Every transaction path requires:

1. A proposal card.
2. Passing guard checks.
3. The user clicking `Approve & Sign`.
4. `executeAgentPlan(..., { userApproved: true })`.
5. The connected wallet signing the SDK transaction.

Read-only actions such as explaining balances or showing settings do not require a transaction.

## Provider/model config

All provider configuration is server-only and must not use `NEXT_PUBLIC_`:

- `SABLE_AGENT_LLM_PROVIDER=deepseek|gemini|groq|none`
- `SABLE_AGENT_LLM_API_KEY=`
- `SABLE_AGENT_LLM_MODEL=`
- `SABLE_AGENT_LLM_BASE_URL=`
- `SABLE_AGENT_MAX_TOKENS=`
- `SABLE_AGENT_TEMPERATURE=0`

Default model choices are configurable low-cost options:

- DeepSeek: `deepseek-chat`
- Gemini: `gemini-2.5-flash-lite`
- Groq: `llama-3.1-8b-instant`

No pricing is hardcoded in the UI.

## Supported commands

- `Create my treasury.`
- `Complete setup.`
- `Add wSOL.`
- `Add USDC.`
- `Add <mint address>.`
- `Deposit 1 USDC.`
- `Send 0.1 USDC to <recipient>.`
- `Batch send 1 USDC to these addresses: <recipient1>, <recipient2>.`
- `External send 0.1 USDC to <recipient>.`
- `Delegate to MagicBlock.`
- `Commit and undelegate.`
- `Withdraw 0.5 USDC to my wallet.`
- `Explain my balances.`
- `Show settings.`

## Unsupported commands

- Autonomous execution.
- Signing with an agent-held key.
- Submitting transactions without wallet approval.
- Claims that MagicBlock ER, PER, or private payments are live when environment configuration is missing.
- Free-form protocol actions outside the currently supported SDK methods.

## Environment variables

Client-visible public app settings remain in `NEXT_PUBLIC_*` variables for RPC/program/router display and SDK setup.

Agent LLM keys and model settings are server-only:

- `SABLE_AGENT_LLM_PROVIDER`
- `SABLE_AGENT_LLM_API_KEY`
- `SABLE_AGENT_LLM_MODEL`
- `SABLE_AGENT_LLM_BASE_URL`
- `SABLE_AGENT_MAX_TOKENS`
- `SABLE_AGENT_TEMPERATURE`

## Commands run

Pre-clean:

- `git status --short`
- `df -h .`
- `du -sh . ...`

Cleanup:

- Removed only regenerable `node_modules`, `.next`, `dist`, and `target` directories.

Post-clean:

- `df -h .`
- `du -sh . ...`
- `git status --short`

Verification commands are listed in the final implementation notes with pass/fail status.

## Remaining risks

- Simulation is best-effort and currently reports unavailable from the chat proposal when no unsigned transaction builder is exposed by the SDK.
- Recipient joined/mint-added status for internal transfers is not fully preflighted in the chat guard; the SDK/program remains the source of truth.
- Balance sufficiency is only as good as locally readable account state. Delegated/PER reads may require configured MagicBlock services.
- MagicBlock delegation/commit flows depend on router/indexer/validator availability.
- The deterministic parser is intentionally conservative and may ask for missing fields for ambiguous commands.

## Demo script

1. Open Agent Chat.
2. Ask: `Create my treasury.`
3. Review proposal and approve/sign.
4. Ask: `Add USDC.`
5. Review proposal and approve/sign.
6. Ask: `Deposit 1 USDC.`
7. Review proposal and approve/sign.
8. Ask: `Send 0.1 USDC to <recipient>.`
9. Review proposal.
10. Reject once to show safety.
11. Ask again and approve/sign.
12. Ask: `Withdraw 0.5 USDC to my wallet.`
13. If delegated, Sable Agent proposes commit/undelegate first.
