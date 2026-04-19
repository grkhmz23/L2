use anchor_lang::prelude::*;
use crate::error::SableError;
use crate::events::PolicyUpdated;
use crate::state::{AgentState, SpendPolicy, UserState};

#[derive(Accounts)]
pub struct SetPolicy<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    #[account(mut)]
    pub agent: Account<'info, AgentState>,

    #[account(
        seeds = [crate::USER_STATE_SEED.as_bytes(), agent.root_user.as_ref()],
        bump = root_user.bump,
    )]
    pub root_user: Account<'info, UserState>,

    pub root_owner: Signer<'info>,
}

/// Update an agent's spend policy.
/// Only the root_user owner can update policy.
pub fn set_policy(ctx: Context<SetPolicy>, policy: SpendPolicy) -> Result<()> {
    let agent = &mut ctx.accounts.agent;

    // Verify the provided root_user matches agent's recorded root_user
    require!(
        agent.root_user == ctx.accounts.root_user.key(),
        SableError::InvalidAncestorChain
    );

    // Verify signer is the root_user owner
    require!(
        ctx.accounts.root_user.owner == ctx.accounts.root_owner.key(),
        SableError::NotAgentRoot
    );

    // Replace policy
    agent.policy = policy;

    emit!(PolicyUpdated {
        agent: agent.key(),
        root_user: agent.root_user,
        per_tx_limit: policy.per_tx_limit,
        daily_limit: policy.daily_limit,
        total_limit: policy.total_limit,
        counterparty_mode: policy.counterparty_mode as u8,
        expires_at: policy.expires_at,
    });

    Ok(())
}
