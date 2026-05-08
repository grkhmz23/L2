# Sable Frontend Brand Audit

Date: 2026-05-08

## Summary

This pass focused on demo-readiness for the Sable frontend without changing Anchor program behavior. The app now presents Sable as a premium Solana agent treasury, exposes the transaction console on the main Treasury page, truncates/copies long addresses and signatures, bounds modal height for demo viewports, and removes frontend copy that implied live private/PER/payment behavior without configured services.

The core frontend remains wired to the existing SDK/Anchor flows. MagicBlock ER delegation hooks are available through the existing SDK methods. PER/private read paths and optional payments funding still require configured external services.

## Issues Found

- The Treasury page did not show the existing Deposit, Send, Batch Send, Withdraw, and Delegate forms, leaving the main demo path visually incomplete.
- Long public keys, mint addresses, task IDs, and signatures were rendered as raw or weakly truncated text in multiple cards and modals.
- The setup, funding, agent, and task modals could feel cramped or overflow at 1440x900.
- Several UI labels overclaimed privacy or production behavior, including "Private Mode", "balances hidden", and live private payment language.
- The sidebar/header brand mark was a placeholder letter rather than a reusable Sable identity component.
- Buttons and panels used inconsistent radius, spacing, and copy; several action buttons did not clearly describe the user action.
- Smoke coverage did not check sidebar rendering or setup modal long-text handling.

## Fixes Made

- Added reusable Sable brand primitives in `app/src/components/ui/luxury.tsx`:
  - `SableMark`
  - `SableLogo`
  - `CopyButton`
  - `CopyableAddress`
- Refined shared UI defaults for buttons, inputs, textareas, pills, cards, and section headers to prevent overflow and improve consistency.
- Added Sable color tokens in `app/src/app/globals.css` and `app/tailwind.config.js`.
- Updated sidebar, mobile header, landing page, wallet card, and metadata to use the Sable brand system.
- Added the existing `ActionPanel` to the Treasury page so the demo path is visible from `/app`.
- Reworded MagicBlock/PER/payments copy to distinguish implemented hooks from services that require configured endpoints.
- Replaced raw mint/address/signature text with copyable truncated chips across Treasury, Settings, Activity, Agents, Tasks, x402, and setup/funding flows.
- Tightened modal sizing with max-height and internal scrolling for setup, funding, spawn-agent, create-task, and task-detail flows.
- Clarified action labels:
  - `Add wSOL Balance`
  - `Add Asset`
  - `Send / Batch Send`
  - `Deposit to Vault`
  - `Commit / Undelegate`
  - `Withdraw to Wallet`
- Expanded UI-only smoke tests for sidebar rendering and setup modal long-text handling.

## Viewport Checks

- Static layout audit covered the main demo surfaces requested: Treasury, Agents, Tasks, x402 Demo, Settings, setup modal, transaction forms, delegation status, balance list, and wallet/routing selector.
- Modal sizing was hardened for 1440x900 and 1920x1080 using `max-h-[calc(100vh-2rem)]` and internal scrollbars.
- Long addresses and signatures now render through truncating/copyable chips rather than raw full strings.
- No Playwright screenshot check was added because Playwright is not a direct app/root dependency or existing script. The added smoke tests are UI-only and do not prove backend correctness.

## Commands Run

| Command | Result | Notes |
|---|---:|---|
| `git status --short` | Pass | Pre-existing unrelated deletions: `ARCHITECTURE.md`, `KIMI_PROMPTS.md`, `KIMI_PROMPTS_AMENDMENT_03.md`. Not staged. |
| `df -h .` | Pass | Before cleanup: 40% used. After cleanup: 36% used. |
| `du -sh .` | Pass | Before cleanup: 2.4G. After cleanup: 18M. |
| `find . (...) -exec rm -rf {} +` | Pass | Removed only regenerable folders: `node_modules`, `.next`, `dist`, `target`. |
| `pnpm install` | Pass | Lockfile up to date. |
| `pnpm build:all` | Pass | First run restored workspace package `dist` outputs after cleanup. |
| `pnpm app:typecheck` | Pass | Final run passed. Initial run failed because cleanup removed generated workspace package type outputs. |
| `pnpm app:lint` | Pass | No warnings or errors. |
| `pnpm app:smoke` | Pass | 3 files, 7 tests. UI-only smoke tests. |
| `pnpm app:build` | Pass | Next production build passed. |
| `pnpm build:all` | Pass | Final full workspace build passed. |

Build warnings observed but not blocking:

- `bigint: Failed to load bindings, pure JS will be used`
- `ExperimentalWarning: localStorage is not available because --localstorage-file was not provided`

## Remaining Risks

- PER/private balance reads are not guaranteed unless `NEXT_PUBLIC_SABLE_PER_HTTP` points to a working middleware service.
- Optional payments funding requires configured payments endpoint credentials; direct Anchor deposit remains the reliable demo path.
- The UI smoke tests intentionally do not mock blockchain success as proof of backend correctness.
- The repo still has three pre-existing deleted docs in the working tree that were not created by this pass and were not staged.

## Demo Notes

Use the main Treasury page for the recording:

1. Connect wallet.
2. Create Treasury.
3. Add wSOL Balance or Add Asset.
4. Deposit through the direct Anchor vault form.
5. Send / Batch Send from the transaction console.
6. Delegate to ER only when MagicBlock services are configured.
7. Commit / Undelegate before withdrawals.
8. Withdraw to Wallet.
9. Use Settings to show active RPC/program/router configuration.

