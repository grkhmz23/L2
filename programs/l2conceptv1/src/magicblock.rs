//! MagicBlock Ephemeral Rollup Integration
//! 
//! NOTE: This module provides the instruction signatures and events for MagicBlock ER integration.
//! Actual CPI calls to MagicBlock require:
//! 1. MagicBlock validator running (either local devnet or mainnet)
//! 2. ephemeral-rollups-sdk with compatible Solana/Anchor versions
//! 3. Proper instruction discriminators from MagicBlock documentation
//!
//! Current implementation emits events that MagicBlock can index and process.
//! For full integration, replace event emissions with actual CPI calls.

use anchor_lang::prelude::*;

/// MagicBlock delegation program ID (mainnet)
pub const MAGICBLOCK_DELEGATION_PROGRAM_ID: Pubkey =
    pubkey!("DELeGGvXpWV2fqJUhqcF5ZSYMS4JTLjteaAMARRSaeSh");

/// MagicBlock magic program ID
pub const MAGICBLOCK_MAGIC_PROGRAM_ID: Pubkey =
    pubkey!("Magic11111111111111111111111111111111111111");

/// Validator pubkey for ER (would be configured per environment)
pub fn default_er_validator() -> Pubkey {
    // Default validator for devnet - replace with actual validator for production
    // This is a placeholder pubkey (11111111111111111111111111111111 is the system program)
    pubkey!("11111111111111111111111111111111")
}

/// Commit frequency in slots (5 seconds = ~1 slot)
pub const DEFAULT_COMMIT_FREQUENCY: u64 = 12; // ~1 minute

/// Delegation parameters
#[derive(Clone, Debug, AnchorSerialize, AnchorDeserialize)]
pub struct DelegationParams {
    pub validator: Pubkey,
    pub commit_frequency: u64,
}

impl Default for DelegationParams {
    fn default() -> Self {
        Self {
            validator: default_er_validator(),
            commit_frequency: DEFAULT_COMMIT_FREQUENCY,
        }
    }
}

/// Emitted when account should be delegated to ER
/// MagicBlock indexer can pick this up and process delegation
#[event]
pub struct RequestDelegateEvent {
    pub owner: Pubkey,
    pub accounts: Vec<Pubkey>,
    pub validator: Pubkey,
    pub commit_frequency: u64,
}

/// Emitted when account should be committed/undelegated from ER
/// MagicBlock indexer can pick this up
#[event]
pub struct RequestCommitUndelegateEvent {
    pub owner: Pubkey,
    pub accounts: Vec<Pubkey>,
}

/// Log delegation request for MagicBlock processing
pub fn log_delegate_request(
    owner: Pubkey,
    accounts: Vec<Pubkey>,
    params: DelegationParams,
) {
    emit!(RequestDelegateEvent {
        owner,
        accounts: accounts.clone(),
        validator: params.validator,
        commit_frequency: params.commit_frequency,
    });

    msg!("MAGICBLOCK_DELEGATE_REQUEST:");
    msg!("  owner: {}", owner);
    msg!("  validator: {}", params.validator);
    msg!("  commit_frequency: {} slots", params.commit_frequency);
    msg!("  accounts:");
    for acc in &accounts {
        msg!("    - {}", acc);
    }
}

/// Log commit/undelegate request for MagicBlock processing
pub fn log_commit_undelegate_request(owner: Pubkey, accounts: Vec<Pubkey>) {
    emit!(RequestCommitUndelegateEvent { owner, accounts: accounts.clone() });

    msg!("MAGICBLOCK_COMMIT_UNDELEGATE_REQUEST:");
    msg!("  owner: {}", owner);
    msg!("  accounts:");
    for acc in &accounts {
        msg!("    - {}", acc);
    }
}
