#!/bin/bash
set -euo pipefail

# Sable Devnet Deploy Script
# Usage: ./scripts/deploy-devnet.sh
# Requires: SABLE_DEPLOYER_KEYPAIR env var set to path of deployer keypair

PROGRAM_KEYPAIR="keys/sable-program-keypair.json"

# Resolve absolute paths before changing directory
DEPLOYER_KEYPAIR_ABS=$(realpath "$SABLE_DEPLOYER_KEYPAIR")
PROGRAM_KEYPAIR_ABS=$(realpath "$PROGRAM_KEYPAIR")
PROGRAM_ID="SaSAXcdWhyr1KD8TKRg6K7WPuxcPLZJHKEwsjQgL5Di"

# Validate deployer keypair
if [ -z "${SABLE_DEPLOYER_KEYPAIR:-}" ]; then
    echo "ERROR: SABLE_DEPLOYER_KEYPAIR environment variable is not set."
    echo "Set it to the path of your devnet deployer keypair, e.g.:"
    echo "  export SABLE_DEPLOYER_KEYPAIR=/path/to/deployer.json"
    exit 1
fi

if [ ! -f "$SABLE_DEPLOYER_KEYPAIR" ]; then
    echo "ERROR: Deployer keypair not found at $SABLE_DEPLOYER_KEYPAIR"
    exit 1
fi

if [ ! -f "$PROGRAM_KEYPAIR" ]; then
    echo "ERROR: Program keypair not found at $PROGRAM_KEYPAIR"
    exit 1
fi

# Validate deployer has SOL on devnet
DEPLOYER_PUBKEY=$(solana-keygen pubkey "$SABLE_DEPLOYER_KEYPAIR")
echo "Deployer: $DEPLOYER_PUBKEY"
echo "Program ID: $PROGRAM_ID"

# Check devnet balance
BALANCE=$(solana balance "$DEPLOYER_PUBKEY" --url devnet 2>/dev/null || echo "0")
echo "Devnet balance: $BALANCE SOL"

if [ "$BALANCE" = "0" ] || [ "$BALANCE" = "0 SOL" ]; then
    echo "WARNING: Deployer has zero balance on devnet. Airdrop may be needed:"
    echo "  solana airdrop 2 $DEPLOYER_PUBKEY --url devnet"
fi

# Build
echo "Building program..."
cd programs/sable
cargo build-sbf

# Deploy
echo "Deploying to devnet..."
solana program deploy \
    target/deploy/sable.so \
    --program-id "$PROGRAM_KEYPAIR_ABS" \
    --url devnet \
    --keypair "$DEPLOYER_KEYPAIR_ABS" \
    --upgrade-authority "$DEPLOYER_KEYPAIR_ABS"

cd ../..

echo ""
echo "========================================"
echo "Deployment complete!"
echo "Program ID: $PROGRAM_ID"
echo "Explorer: https://explorer.solana.com/address/$PROGRAM_ID?cluster=devnet"
echo "========================================"
