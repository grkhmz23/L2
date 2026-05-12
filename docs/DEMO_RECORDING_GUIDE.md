# Sable Hackathon Demo — Recording Guide

## Quick Start

1. **Open the demo page:**
   ```
   https://your-vercel-url.vercel.app/app/demo
   ```
   Or locally:
   ```bash
   cd /workspaces/Sable
   pnpm app:dev
   # Open http://localhost:3000/app/demo
   ```

2. **Connect wallet:**
   - Use Phantom (devnet)
   - Ensure wallet has devnet SOL
   - Ensure wallet has devnet USDC (or use the mock/demo flow)

3. **Follow the script:**
   - Read `docs/DEMO_VIDEO_SCRIPT.md` for exact narration
   - Read `docs/DEMO_STORYBOARD.md` for visual reference

---

## Pre-Recording Setup

### Wallet Preparation
```bash
# Switch to devnet
solana config set --url devnet

# Airdrop SOL
solana airdrop 2

# Optional: pre-create treasury and add USDC off-camera
# This saves ~30 seconds in the final video
```

### Browser Setup
- **Browser:** Chrome or Brave (best wallet support)
- **Window size:** 1440×900 or 1920×1080
- **Zoom:** 100%
- **Extensions:** Disable unnecessary extensions
- **Cursor:** Enable pointer highlighting
  - macOS: Accessibility → Pointer Control → Pointer Size (increase)
  - Or use KeyCastr / mouseposé

### Screen Recording
- **Tool:** OBS, ScreenFlow, Loom, or built-in screen recorder
- **Resolution:** 1920×1080 @ 60fps
- **Audio:** Record narration separately for better quality, or narrate live

---

## Scene-by-Scene Timing

| Scene | Action | Duration | Narration cue |
|---|---|---|---|
| 1 | Landing → Connect | 15s | "Sable is a privacy-first agent treasury..." |
| 2 | Agent Chat intro | 10s | "This is the Agent Chat..." |
| 3 | Create Treasury | 20s | "Let's start. I want to create my treasury." |
| 4 | Add USDC | 15s | "Now I need to add USDC..." |
| 5 | Deposit 1 USDC | 20s | "Let's deposit one USDC..." |
| 6 | Send — Rejected | 15s | "I'll show the safety model..." |
| 7 | Send — Approved | 15s | "Okay, let's actually send it." |
| 8 | Batch Send | 15s | "Sable also supports batch sends..." |
| 9 | Delegate | 15s | "For speed, I can delegate..." |
| 10 | Withdraw | 10s | "Finally, I want my funds back." |
| 11 | Outro | 10s | "Sable Agent prepares. The user decides." |
| **Total** | | **~2:00** | |

---

## Pro Tips

1. **Pre-seed the treasury:** Create the treasury and add USDC before recording. Start recording from the Deposit step. This saves 30+ seconds.

2. **Wallet popup visibility:** Do not crop out the Phantom popup. The signing moment is the best proof of safety.

3. **Pause after success:** Let the success message and signature sit on screen for 2 seconds before continuing.

4. **Quick action chips:** Hover over them briefly in Scene 2 to show they're clickable.

5. **If devnet is slow:** You can use the local `solana-test-validator` instead. Set `NEXT_PUBLIC_SOLANA_RPC_URL=http://127.0.0.1:8899` and pre-fund the wallet.

6. **Background music:** Keep it under -20dB so narration is clear.

7. **Outro card:** Add a text overlay with:
   - `github.com/grkhmz23/Sable`
   - `Built for MagicBlock Privacy Track`

---

## Troubleshooting

| Problem | Solution |
|---|---|
| Wallet won't connect | Ensure Phantom is set to Devnet |
| "Insufficient balance" | Airdrop more SOL or reduce amounts |
| Agent chat shows errors | Refresh page, ensure RPC is reachable |
| Proposal card doesn't appear | Check that message is scoped (not out-of-scope) |
| Slow transaction | Devnet can be slow; use local validator |

---

## Files

- `docs/DEMO_VIDEO_SCRIPT.md` — Full narration script
- `docs/DEMO_STORYBOARD.md` — Visual storyboard with ASCII frames
- `docs/DEMO_RECORDING_GUIDE.md` — This file
- `app/src/app/app/demo/page.tsx` — Demo page with helper banner
