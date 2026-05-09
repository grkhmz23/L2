# Agent Scope Guard Report

## Allowed scope

Sable Agent Chat is now restricted to Sable protocol actions inside the app:

- Create or complete Sable treasury setup
- Add wSOL balance
- Add supported asset or mint
- Explain Sable treasury balances
- Deposit to the Sable vault
- Send or batch send through the Sable ledger
- External vault send when available
- Delegate to MagicBlock ER when configured
- Commit / undelegate
- Withdraw to wallet
- Show Sable settings, RPC, program, and router configuration
- Explain Sable-specific prerequisites, errors, and next steps
- Prepare transaction proposals for wallet approval/signature

## Token-saving classifier

The local `classifySableScope` guard runs before deterministic planning and before any LLM provider call.

- `sable_protocol`: continue to deterministic/LLM planning.
- `out_of_scope`: return the local refusal copy and do not call an LLM.
- `ambiguous`: ask a short Sable-specific clarification and do not call an LLM.

Required refusal copy:

`I can only help with Sable treasury actions inside this app: setup, assets, deposits, transfers, delegation, commit/undelegate, withdrawals, and settings.`

Ambiguous clarification:

`Which Sable action do you want to perform: setup, add asset, deposit, send, delegate, commit, withdraw, or settings?`

## Blocked examples

- `What is Bitcoin?`
- `Tell me about Solana price`
- `Write me code`
- `Explain politics`
- `Give investment advice`
- `What is the best token to buy?`
- `Summarize this article`
- `Chat with me`
- `Tell a joke`
- `Build a trading bot`
- `Search the web`
- `Explain MagicBlock generally`

## Supported Sable commands

- `Create my treasury`
- `Complete setup`
- `Add USDC`
- `Add wSOL`
- `Add <mint address>`
- `Deposit 1 USDC`
- `Send 0.1 USDC to <recipient>`
- `Batch send 1 USDC to these addresses: <recipient1>, <recipient2>`
- `External send 0.1 USDC to <recipient>`
- `Delegate to MagicBlock`
- `Commit and undelegate`
- `Withdraw 0.5 USDC to my wallet`
- `Explain my balances`
- `Show settings`

## Safety guard updates

- Added `OUT_OF_SCOPE` and `CLARIFY_SABLE_ACTION` action types.
- Added `domain: "sable_protocol" | "out_of_scope" | "ambiguous"` to action plans.
- Execution rejects `OUT_OF_SCOPE`, `CLARIFY_SABLE_ACTION`, `UNKNOWN`, any non-`sable_protocol` plan, and any call without `userApproved=true`.
- UI renders local refusal/clarification messages without proposal cards or `Approve & Sign`.

## Commands run

Verification command results are recorded in the final implementation response.

## Remaining risks

- The classifier is intentionally conservative and may refuse unusual phrasing until the user names a Sable action.
- Provider prompts are hardened, but the local classifier is the primary protection because it prevents provider calls for blocked topics.
- MagicBlock action availability still depends on configured router/PER services.
